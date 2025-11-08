import { RoutingConfig } from "../server/utils/loadConfig"

const config: RoutingConfig = {
    getRouterDirectory() {
        return "routes"
    },
    autoDescribe: false, 
    getStartupDirPath() {
        return "startup"
    }
}
export default config