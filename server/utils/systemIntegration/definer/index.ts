import path from "path";
import { redisConfig } from "../../../config/redis/index.js";
import ObjectError from "../../ObjectError/index.js";
import { JSONObject } from "../../common/index.js";
import makeThreadedJson, { JSONSourceFilePath } from "../../dynamicJson/threadedJson.js";
type SystemIntegrationRegistrationProps<Configuration extends { [key: string]: any }> = {
    connectionId: string;
    config: Configuration;
};

type Instance<
    OperationsType extends {
        [key: string]: (...args: any) => Promise<any>;
    },
    Configuration extends any,
> = {
    isActive: () => Promise<boolean>;
    operations: OperationsType;
    testConnection: () => Promise<boolean>;
    deactivate: () => Promise<void>;
    activate: () => Promise<void>;
    getConfig: () => Promise<Configuration>;
    updateConfig(newConfig: Configuration): Promise<void>;
};

type SystemIntegrationDefinitionProps<
    OperationsType extends {
        [key: string]: (...args: any) => any;
    },
    Configuration extends JSONObject,
> = {
    /**
     * system definition simple id such as "OdooErp"
     */
    definitionId: string;

    /**
     * the absolute directory path to were to store configurations and definitions files
     */
    definitionPath: string;

    /**
     * connection test method should be simple and fast, it should check if the remote system is reachable.
     */
    testConnection: (config: Configuration) => boolean | Promise<boolean>;

    /**
     * define the operation performed on the instance,
     * in short what can you do remotely,
     * and why are you building the remote connection in the first place
     *
     * @param props
     * @returns
     */
    buildOperations: (props: {
        getConfiguration: () => Promise<Configuration>;
    }) => Promise<OperationsType> | OperationsType;
};

export const define = async <
    OperationsType extends {
        [key: string]: (...args: any) => Promise<any>;
    },
    Configuration extends JSONObject,
>(
    systemDefinition: SystemIntegrationDefinitionProps<OperationsType, Configuration>,
) => {
    type MainConfig = {
        definitionId: string;
        instances: {
            [instanceId: string]: {
                config: SystemIntegrationRegistrationProps<Configuration>;
                active: boolean;
            };
        };
    };

    function getMainConfigFilePath(): JSONSourceFilePath {
        const definitionJsonPath = path.join(systemDefinition.definitionPath, "main.json");
        return definitionJsonPath as JSONSourceFilePath;
    }

    const mainConfigThreadedJson = await makeThreadedJson({
        source: redisConfig.useRedis()
            ? {
                  type: "redis",
                  uniqueIdentifier: `systemIntegrationInstance:${systemDefinition.definitionId}`,
              }
            : {
                  fileFullPath: getMainConfigFilePath(),
                  type: "jsonFile",
              },
    });

    async function getMainConfig() {
        const configuration: MainConfig = await mainConfigThreadedJson.get([]);
        return configuration;
    }

    async function updateMainConfig(mainConfig: MainConfig) {
        return await mainConfigThreadedJson.updateJsonFromProvided(mainConfig);
    }

    async function registerInstanceConfiguration(props: SystemIntegrationRegistrationProps<Configuration>) {
        if (await mainConfigThreadedJson.get(["instances", props.connectionId])) {
            throw new ObjectError({
                statusCode: 400,
                error: {
                    msg: "this connection id already used in " + systemDefinition.definitionId,
                },
            });
        }
        await mainConfigThreadedJson.set(["instances"], props.connectionId, {
            config: props,
            active: true,
        });
    }

    async function updateInstanceConfiguration(id: string, newConfiguration: Configuration) {
        if (!(await mainConfigThreadedJson.get(["instances", id]))) {
            throw new ObjectError({
                error: {
                    msg: "integration instance with id " + id + " is not registered",
                },
                statusCode: 404,
            });
        }
        await mainConfigThreadedJson.set(["mainConfig", "instances", id, "config"], "config", newConfiguration);
    }

    async function getInstanceConfiguration(
        id: string,
    ): Promise<SystemIntegrationRegistrationProps<Configuration> | null> {
        return mainConfigThreadedJson.get(["instances", id, "config"]) || null;
    }

    async function isInstanceActive(id: string) {
        return await mainConfigThreadedJson.get(["instances", id, "active"]);
    }

    const instancesMap = {} as Record<string, Instance<OperationsType, Configuration>>;

    async function getInstance(id: string): Promise<Instance<OperationsType, Configuration> | null> {
        if (!(await mainConfigThreadedJson.get(["instances", id]))) {
            return null;
        }

        if (instancesMap[id]) {
            return instancesMap[id];
        }

        const instanceStatusThreadedJson = await makeThreadedJson({
            initialContent: {
                lastKnownStatus: "unknown" as "working" | "not-working" | "unknown",
            },
            source: {
                type: "inMemory",
                uniqueIdentifier: `connectionInstance:${systemDefinition.definitionId}:${id}:status`,
            },
        });

        const updateLastKnownStatus = async (status: "working" | "not-working" | "unknown") => {
            await instanceStatusThreadedJson.set([], "lastKnownStatus", status);
        };

        const validateIsActive = async () => {
            const active = await isInstanceActive(id);
            if (!active) {
                throw new ObjectError({
                    error: {
                        msg: `connection instance ${id} is deactivated`,
                    },
                    statusCode: 403,
                });
            }
        };

        const getConfig = async () => {
            return (await getInstanceConfiguration(id))?.config as Configuration;
        };
        const wrappedOperations = Object.fromEntries(
            Object.entries(
                await systemDefinition.buildOperations({
                    getConfiguration: getConfig,
                }),
            ).map(([key, operation]) => {
                return [
                    key,
                    async (...args: any) => {
                        await validateIsActive();
                        try {
                            const result = await operation(...args);
                            await updateLastKnownStatus("working");
                            return result;
                        } catch (error: any) {
                            await updateLastKnownStatus("not-working");
                            throw error;
                        }
                    },
                ];
            }),
        );
        async function testConnection() {
            await validateIsActive();
            const success = systemDefinition.testConnection(await getConfig());
            await updateLastKnownStatus(success ? "working" : "not-working");
            return success;
        }
        const instance: Instance<OperationsType, Configuration> = {
            async updateConfig(newConfig: Configuration) {
                return await updateInstanceConfiguration(id, newConfig);
            },
            activate: async () => {
                await mainConfigThreadedJson.set(["instances", id], "active", true);
            },
            deactivate: async () => {
                await mainConfigThreadedJson.set(["instances", id], "active", false);
            },
            isActive: () => isInstanceActive(id),
            getConfig,

            testConnection,
            operations: wrappedOperations as OperationsType,
        };
        instancesMap[id] = instance;

        return instance;
    }

    async function getOrRegisterInstance(props: SystemIntegrationRegistrationProps<Configuration>) {
        const result = await systemDefinition.testConnection(props.config);
        if (result) {
            const existingInstance = await getInstance(props.connectionId);
            if (existingInstance) {
                await existingInstance.updateConfig(props.config);
                return existingInstance;
            } else {
                await registerInstanceConfiguration(props);
                return (await getInstance(props.connectionId)) as Instance<OperationsType, Configuration>;
            }
        } else {
            throw new ObjectError({
                error: {
                    msg: "connection test failed",
                },
                statusCode: 408,
            });
        }
    }

    async function register(props: SystemIntegrationRegistrationProps<Configuration>) {
        const result = await systemDefinition.testConnection(props.config);
        if (result) {
            await registerInstanceConfiguration(props);
            return await getInstance(props.connectionId);
        } else {
            throw new ObjectError({
                error: {
                    msg: "connection test failed",
                },
                statusCode: 408,
            });
        }
    }

    return {
        register,
        getOrRegisterInstance,
        getInstance,
        updateMainConfig,
        updateInstanceConfiguration,
        isInstanceActive,
        getMainConfig,
        getInstanceConfiguration,
    };
};
