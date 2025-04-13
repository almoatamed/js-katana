import fs from "fs";
import path from "path";
import ObjectError from "../../ObjectError/index.js";
import { JSONObject } from "../../common/index.js";
import { hashWithSHA256 } from "../../crypto/hash.js";
import makeThreadedJson, {
    JSONSourceFilePath,
    OptionsNoBroadCast,
    ThreadedJson,
} from "../../dynamicJson/threadedJson.js";
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
    instancePaths: {
        directory: string;
        configFullPath: JSONSourceFilePath;
    };
    instanceConfigThreadedJson: ThreadedJson<JSONSourceFilePath, unknown>;
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
                instanceConfigurationPath: string;
                active: boolean;
            };
        };
    };

    function getMainConfigFilePath(): JSONSourceFilePath {
        const definitionJsonPath = path.join(systemDefinition.definitionPath, "main.json");
        return definitionJsonPath as JSONSourceFilePath;
    }

    function getInstancesDirPath() {
        return path.join(systemDefinition.definitionPath, "instances");
    }

    function createConfigurationSchema() {
        const configPath = getMainConfigFilePath();
        const configFileExists = fs.existsSync(configPath);
        if (!configFileExists) {
            const configPathDir = path.dirname(configPath);
            if (!fs.existsSync(configPathDir)) {
                fs.mkdirSync(configPathDir, {
                    recursive: true,
                });
            }
            fs.writeFileSync(
                path.join(configPathDir, ".gitignore"),
                `
main.json


!**/.gitignore
`,
            );

            fs.writeFileSync(
                configPath,
                JSON.stringify(
                    {
                        definitionId: systemDefinition.definitionId,
                        instances: {},
                    },
                    null,
                    4,
                ),
            );

            const instancesDirPath = getInstancesDirPath();
            fs.mkdirSync(instancesDirPath, { recursive: true });
            fs.writeFileSync(
                path.join(instancesDirPath, ".gitignore"),
                `
*.*
**/*.*

!**/.gitignore
`,
            );
        }
    }

    createConfigurationSchema();

    const mainConfigThreadedJson = await makeThreadedJson<MainConfig, JSONSourceFilePath, OptionsNoBroadCast<string>>(
        getMainConfigFilePath(),
        {
            lazy: false,
            uniqueEventId: `systemIntegrationInstance:${systemDefinition.definitionId}`,
            broadcastOnUpdate: false,
        },
    );

    async function getMainConfig() {
        const configuration: MainConfig = await mainConfigThreadedJson.get([]);
        return configuration;
    }

    function getInstanceConfigurationFilePath(id: string) {
        if (id.length < 3) {
            throw new ObjectError({
                error: {
                    msg: "Connection instance identifier must be longer than 3 characters",
                },
                statusCode: 400,
            });
        }
        const fileName = hashWithSHA256(id);
        return {
            directory: path.join(getInstancesDirPath(), fileName),
            configFullPath: path.join(getInstancesDirPath(), fileName, `config.json`) as JSONSourceFilePath,
        };
    }

    async function updateMainConfig(mainConfig: MainConfig) {
        return await mainConfigThreadedJson.updateJsonFromProvided(mainConfig);
    }

    async function registerInstanceConfiguration(props: SystemIntegrationRegistrationProps<Configuration>) {
        const mainConfig = await getMainConfig();

        if (mainConfig.instances[props.connectionId]) {
            throw new ObjectError({
                statusCode: 400,
                error: {
                    msg: "this connection id already used in " + systemDefinition.definitionId,
                },
            });
        }
        const instanceConfigurationFilePath = getInstanceConfigurationFilePath(props.connectionId);
        mainConfig.instances[props.connectionId] = {
            instanceConfigurationPath: instanceConfigurationFilePath.configFullPath,
            active: true,
        };
        await updateMainConfig(mainConfig);
        fs.mkdirSync(instanceConfigurationFilePath.directory, { recursive: true });
        fs.writeFileSync(instanceConfigurationFilePath.configFullPath, JSON.stringify(props.config));
    }

    async function updateInstanceConfiguration(id: string, newConfiguration: Configuration) {
        const mainConfig = await getMainConfig();
        if (!mainConfig.instances[id]) {
            throw new ObjectError({
                error: {
                    msg: "integration instance with id " + id + " is not registered",
                },
                statusCode: 404,
            });
        }
        const instanceConfigurationFilePath = getInstanceConfigurationFilePath(id);
        fs.mkdirSync(instanceConfigurationFilePath.directory, { recursive: true });
        fs.writeFileSync(instanceConfigurationFilePath.configFullPath, JSON.stringify(newConfiguration));
    }

    function getInstanceConfiguration(id: string): Configuration | null {
        const configPath = getInstanceConfigurationFilePath(id);
        if (!fs.existsSync(configPath.configFullPath)) {
            return null;
        }
        return JSON.parse(fs.readFileSync(configPath.configFullPath, "utf-8")) as Configuration;
    }

    async function isInstanceActive(id: string) {
        const mainConfig = await getMainConfig();
        return !!mainConfig.instances[id]?.active;
    }

    const instancesMap = {} as Record<string, Instance<OperationsType, Configuration>>;

    async function getInstance(id: string): Promise<Instance<OperationsType, Configuration> | null> {
        const mainConfig = await getMainConfig();
        if (!mainConfig.instances[id]) {
            return null;
        }

        if (instancesMap[id]) {
            return instancesMap[id];
        }

        const instancePaths = getInstanceConfigurationFilePath(id);
        const instanceConfigThreadedJson = await makeThreadedJson(instancePaths.configFullPath, {
            broadcastOnUpdate: false,
            uniqueEventId: `connectionInstance:${systemDefinition.definitionId}:${id}:config`,
        });
        const instanceStatusThreadedJson = await makeThreadedJson(
            {
                lastKnownStatus: "unknown" as "working" | "not-working" | "unknown",
            },
            {
                filePath: path.join(instancePaths.directory, "status.json") as JSONSourceFilePath,
                uniqueEventId: `connectionInstance:${systemDefinition.definitionId}:${id}:status`,
                lazy: false,
                broadcastOnUpdate: false,
            },
        );

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
        const wrappedOperations = Object.fromEntries(
            Object.entries(
                await systemDefinition.buildOperations({
                    getConfiguration: () => instanceConfigThreadedJson.get([]) as Promise<Configuration>,
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
        const getConfig = async () => {
            return (await instanceConfigThreadedJson.get([])) as Configuration;
        };
        async function testConnection() {
            await validateIsActive();
            const success = systemDefinition.testConnection(await getConfig());
            await updateLastKnownStatus(success ? "working" : "not-working");
            return success;
        }
        const instance: Instance<OperationsType, Configuration> = {
            async updateConfig(newConfig: Configuration) {
                return await instanceConfigThreadedJson.updateJsonFromProvided(newConfig);
            },
            activate: async () => {
                const mainConfig = await getMainConfig();
                if (mainConfig.instances[id]) {
                    if (!mainConfig.instances[id].active) {
                        mainConfig.instances[id].active = true;
                        await updateMainConfig(mainConfig);
                    }
                }
            },
            isActive: () => isInstanceActive(id),
            getConfig,
            instancePaths,
            instanceConfigThreadedJson,
            deactivate: async () => {
                const mainConfig = await getMainConfig();
                if (mainConfig.instances[id]) {
                    if (mainConfig.instances[id].active) {
                        mainConfig.instances[id].active = false;
                        await updateMainConfig(mainConfig);
                    }
                }
            },
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
        mainConfigThreadedJson,
        updateMainConfig,
        updateInstanceConfiguration,
        isInstanceActive,
        getMainConfig,
        getInstanceConfiguration,
    };
};
