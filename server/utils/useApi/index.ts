export const useApi = <T, A>(options: {
    login: () => Promise<A>;
}): {
    use: (use: (authenticationProps: A) => Promise<T>) => Promise<T>;
} => {
    let loginProps: A;
    return {
        use: async (perform) => {
            try {
                if (!loginProps) {
                    loginProps = await options.login();
                }
                return await perform(loginProps);
            } catch (error: any) {
                console.log("Error in use api", error?.response?.data || error?.message, error?.response?.status);
                loginProps = await options.login();
                try {
                    return await perform(loginProps);
                } catch (error: any) {
                    throw {
                        statusCode: error?.response?.status || 408,
                        error: error,
                    };
                }
            }
        },
    };
};
