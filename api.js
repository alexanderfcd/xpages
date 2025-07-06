const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const config = require('./config');
const interceptors = require('./api-event-interceptors');

const getDir = dir => {
    // Normalize the input directory path first for a reliable check
    const normalizedDir = dir.replace(/[\/\\]/g, path.sep);
    // Normalize __dirname as well, as it might contain mixed separators on Windows
    const normalized__dirname = __dirname.replace(/[\/\\]/g, path.sep);
    // Check if the normalized dir already starts with the normalized __dirname
    if (normalizedDir.startsWith(normalized__dirname)) {
        // If it does, it might be an absolute path already containing __dirname, or __dirname itself
        return normalizedDir;
    }
    // Prepend __dirname if it's not already part of the path
    // Ensure no double separators if normalizedDir was empty or just a filename
    if (normalizedDir.startsWith(path.sep)) {
        return `${normalized__dirname}${normalizedDir}`.replace(/[\/\\]/g, path.sep);
    }
    return `${normalized__dirname}${path.sep}${normalizedDir}`.replace(/[\/\\]/g, path.sep);
};

const emptyDir = dirPath => {
    dirPath = getDir(dirPath);

    if(!fs.existsSync(dirPath)) {
        return;
    }
    const dirContents = fs.readdirSync(dirPath);

    for (const fileOrDirPath of dirContents) {
        try {
            const fullPath = path.join(dirPath, fileOrDirPath);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                if (fs.readdirSync(fullPath).length) emptyDir(fullPath);
                fs.rmdirSync(fullPath);
            } else fs.unlinkSync(fullPath);
        } catch (ex) {
            console.error(ex.message);
        }
    }
}

const _renderSingle = async (conf = example) => {
    if(interceptors.onBeforeItemRender) {
        conf = await interceptors.onBeforeItemRender(conf, {path});

    }
    await copyFolder(`templates${path.sep}${conf.template}${path.sep}assets`, `${conf.targetFolder}${path.sep}assets`); // Added await
    await renderTemplateFiles(conf);
}

const render = async (conf = example) => {
    emptyDir(`${config.output}${path.sep}global-assets`);
    await copyFolder(`global-assets`, `global-assets`); // Added await

    if(!conf.length) {
     conf = [conf];
    }
    let count = 0;
    for (let c of conf) {
        count++;
        console.log(`writing ${count} of ${conf.length}` );
     await _renderSingle(c);
    }
}

const pageTitle = function(file, data) {

    if(data && file && data.pageTitles && data.pageTitles[file]) {

        return data.pageTitles[file];
    }

    return data.title || '';
}

const renderTemplateFiles = async (conf = example) => {


    emptyDir((conf.targetFolder));

    const { minify } = require('html-minifier-terser');

    return new Promise(async resolve => {
        const files = getTemplateFiles(conf);
        let filesAnalized = [];
        if(interceptors.filesAnalize) {
            filesAnalized = interceptors.filesAnalize(files, conf, {path});

        }
        let count = 0;
        for(let file of files) {
            count++
            await new Promise(resolve => {
                 conf.templateData.__files = files;
                 conf.templateData.__filesAnalized = filesAnalized;
                 conf.templateData.__path = path;

                 const fileName = file.split(path.sep).pop()

                 let targetFile = `${config.output}${path.sep}${conf.targetFolder}${path.sep}${fileName}`;

                 let targt = targetFile;
                conf.templateData.pageTitle = pageTitle(fileName, conf.templateData);
                conf.templateData.template = conf.template;





                ejs.renderFile(file, conf.templateData, {}, async function(err, str){
                    if(err) {
                        console.log(err);
                        resolve(false);
                        return false
                    }


                    if(interceptors.onRenderFile) {
                        targt = interceptors.onRenderFile(targt, conf, file);
                        if(!targt) {
                            resolve(false)
                        }
                    }


                    str = await minify(str, {
                        collapseWhitespace: true,
                        html5: true,
                        minifyCSS: true,
                        minifyJS: true,
                        processConditionalComments: true,
                        removeComments: true,
                        removeEmptyAttributes: true,
                      });

                    fs.writeFile(getDir(targt), str, function (err) {
                        if (err) throw err;
                        resolve(true)
                    });
                });
            })
        }

        resolve()


    })
}

// sync and recursive
function getFiles (dir, files_){
    files_ = files_ || [];
    var files = fs.readdirSync(dir);
    for (var i in files){
        var name = dir + '/' + files[i];
        if (fs.statSync(name).isDirectory()){
            getFiles(name, files_);
        } else {
            files_.push(name);
        }
    }
    return files_;
}

const minifyJS = async arr => {
    const { minify } = require("terser");


    for (let i = 0; i < arr.length; i++) {
        let code = fs.readFileSync(arr[i], 'utf8');
        let result = await minify(code, { sourceMap: false });
        fs.writeFileSync(arr[i], result.code);

    }
}

const minifyCSS =   arr => {
    const { minify } = require('csso');
    for (let i = 0; i < arr.length; i++) {
        let code = fs.readFileSync(arr[i], 'utf8');
        let result = minify(code);
        fs.writeFileSync(arr[i], result.css);

    }
}



const minifyAssets = async target => { // Made async
    target = getDir(target);

    const allFiles = getFiles(target)

    const js = allFiles.filter(file => file.includes('.js'));
    const css = allFiles.filter(file => file.includes('.css'));

    await minifyJS(js); // Added await
    minifyCSS(css); // minifyCSS is currently sync, can be awaited if it becomes async




}

const copyFolder = async (from, to) => { // Made async
    let target =  `${config.output}/${to}`;
    target = target.trim().replace(/\/\//g, "/");

     console.log('copying', from, 'to', target);

    fs.cpSync(getDir(from), getDir(target), {recursive: true});

    console.log('minifying assets...');

    await minifyAssets(target); // Added await


}

const getTemplateFiles = (conf, filter = '.html') => {
    let template = conf.template;

    template = `templates${path.sep}${template}`;


    if (!fs.existsSync(getDir(template))) {
        console.log("no dir ", template);
        return [];
    }

    const files = fs.readdirSync(getDir(template));

    let res = [];
    for (let i = 0; i < files.length; i++) {
        let filename = path.join(template, files[i]);
        if (  filename.endsWith(filter)) {
            res.push(filename)

        }
    }
    if(interceptors.onFilesList) {
        res = interceptors.onFilesList(res, conf);
    }
    return res;
}



module.exports = {
    getTemplateFiles,
    emptyDir,
    copyFolder,
    render,
    renderTemplateFiles
}
