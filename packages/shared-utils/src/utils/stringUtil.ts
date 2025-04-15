export function replaceTokens(tokenizedString:string, replacements:Record<string,string>):string {
    const searchExp:RegExp = /(\{\w+\})+/g;
    const newString:string = tokenizedString.replace(searchExp, (str,...args) => {
        let key:string = (str.replace(/\{|\}/g, ''));
        let val:string = replacements[key];
        const word:string = val; //replacements[idx]; 
        return word;
    });

    console.log(newString);
    return newString;
}

export function getFileExtension(filepath:string):string {
    let ext:string[] = filepath.toLowerCase().match(/(\.[htm|json|html|xml|txt]{1,4})$/g) || [''];
    console.log('found ', ext);
    return ext[0];
}