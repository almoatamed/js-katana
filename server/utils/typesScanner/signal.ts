import axios from "axios";
import { autoDescribe, isDev } from "../loadConfig/index.js";
import cluster from "cluster";

export const maybeSignalTypeProcessor = async () => {
    if(!(await isDev()) || !(cluster.isPrimary) || !(await autoDescribe())){
        return 
    }
    try {
        await axios.get("http://localhost:3751/process", {
        });
    } catch (error: any) {
        console.error(error.message);
    }
};
