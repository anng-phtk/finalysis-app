
let myfilepath = 'http://sec.gov/abc.txt.json'

function getFileExtension(filepath) {
    
    let ext = filepath.match(/(\.[htm|json|html|xml|txt]{1,4})$/g)
    return ext[ext.length-1];
}


console.log(getFileExtension(myfilepath));


const fileSvc = createRemoteFetchSvc({
        url:url,
        retryDelay:1000,
        retry:3,
        backOff:2,
        timeout:3000
    } as RemoteFileSvcConfig,
    createLoggerSvc({
        type:"both",
        env:"dev",
        filename:'remote-fetch',
        maxLogSize:102400,
        compress:true,
        backups:2
    }));
    let content:string = await fileSvc.getRemoteFile();
    console.log(content.substring(0,100));