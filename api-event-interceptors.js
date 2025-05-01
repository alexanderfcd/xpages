const { url } = require('inspector');
const path = require('path');

const sharp = require('sharp');
const fs = require('fs');


const optimizeImage = async url => {
 
    
    const name = url.split('?')[0].split('/').pop();

    const target = '.' + path.sep + 'dist' + path.sep + 'global-assets' + path.sep + 'default' + path.sep + 'logos' + path.sep + name + '.webp';

    const urlRes = `/global-assets/default/logos/${name}.webp`
 
    if(fs.existsSync(target)) {
        return urlRes;
    }

    if(url.indexOf('http') !== 0) { 
        console.warn('⚠  invalid url: ', url);
        return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    }

    try {
        let  imgresp = await fetch(url);

        if (!imgresp.ok) {
            console.warn('⚠ Network response error:', imgresp.status, imgresp.statusText, 'for url:', url);
            return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
          }
         
        if(imgresp.headers.get('content-type').indexOf('image/') !== 0) {
            console.warn('⚠  url is not image', url);
            return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
        }
       
        if(imgresp.status !== 200) {
            console.warn('⚠  error fetching image', url);
            return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
        }
    
        imgresp = await imgresp.arrayBuffer();
    
         
         await sharp(imgresp).toFile(target);
    } catch (error) {
        console.warn('⚠  error fetching image', error);
        return 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    }

    return  urlRes;
}

module.exports = {
    onBeforeItemRender: async (oobj, conf) => {
        obj = {...oobj};
        if(!!obj.logo) {
            const name = obj.logo.split('?')[0].split('/').pop();
           obj.logo = await optimizeImage(obj.templateData.info.logo);
        }
        return obj
    },
    onFilesList: (files, conf) => {
        return files;
    },
    filesAnalize: (files, conf, options) => {
 
        return files;
    },
    onRenderFile: (target, conf, file) => {

 
        return target;
    }
    

}