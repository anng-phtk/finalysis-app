
let myfilepath = 'http://sec.gov/abc.txt.json'

function getFileExtension(filepath) {
    
    let ext = filepath.match(/(\.[htm|json|html|xml|txt]{1,4})$/g)
    return ext[ext.length-1];
}


console.log(getFileExtension(myfilepath));