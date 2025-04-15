import { HTTPResponseError } from "../error-handlers/app-errors.js";
import { getFileExtension } from "./stringUtil.js";

export async function getRemoteFile(url:string): Promise<string> {
    try {
        const response:Response = await fetch(url, {headers:{
            "User-Agent":"Finalysis-App finalyze.admin@gmail.com",
            "Accept-Encoding":"gzip, deflate",
            "Host":"www.sec.gov"
        }});

        const responseFileExtension:string = getFileExtension(url);
        if (response.ok) {
           
            console.log(``, responseFileExtension,  `=== `, '.json', (responseFileExtension === '.json'))


            //return JSON.stringify(content);
            
            if (responseFileExtension === '.json') {
                let content = await response.json();
                return JSON.stringify(content);
            }    
            else if (['.htm','.html','xml'].includes(responseFileExtension)) {
                let content = await response.text();
                return content;
            }
            else {
                throw new HTTPResponseError('Fetch Completed but Return Failed.', 'UnhandledFileExtention', response.status)
            }
            
        }
        else {
            throw new HTTPResponseError('Fetch failed with an error.', response.statusText, response.status)
        }
    } catch (error) {
        console.log(error);
        throw error;
    }
}