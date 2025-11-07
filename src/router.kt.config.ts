import { RoutingConfig } from "../server/utils/loadConfig"

const config: RoutingConfig = {
    getRouterDirectory() {
        return "routes"
    },
    getStartupDirPath() {
        return "startup"
    }
}
export default config