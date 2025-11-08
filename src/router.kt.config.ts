import { RoutingConfig } from "../server/utils/loadConfig"
import { throwUnauthorizedError } from "../server/utils/router"

const config: RoutingConfig = {
    getRouterDirectory() {
        return "routes"
    },
    autoDescribe: false, 
    getStartupDirPath() {
        return "startup"
    }, 
    getStaticDirs() {
        return [
            {
                local: "public",
                remote: "/public",
                middlewares: [
                    context=>{       
                        const mat=  context.query.mat;
                        if(mat != "123"){
                            throwUnauthorizedError("Unauthorized Access to Static Files")
                        }
                        console.log(`Serving static file: ${context.fullPath}`);
                    }
                ]
            }
        ]
    },
}
export default config