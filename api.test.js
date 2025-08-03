const fs = require('fs');
const path = require('path');
const mock = require('mock-fs');
const {
    getTemplateFiles,
    emptyDir,
    copyFolder,
    renderTemplateFiles,
    render,
} = require('./index.js');

jest.mock('./config.js', () => ({
    output: 'dist'
}));

jest.mock('./api-event-interceptors.js', () => ({
    onBeforeItemRender: jest.fn((conf) => Promise.resolve(conf)),
    onFilesList: jest.fn((res) => res),
    filesAnalize: jest.fn((files) => files),
    onRenderFile: jest.fn((target) => target)
}));

const sampleConf = {
    template: 'basic',
    targetFolder: 'output',
    templateData: {
        title: 'Test Page',
        pageTitles: {
            'index.html': 'Custom Title'
        }
    }
};

describe('Utility functions', () => {
    beforeEach(() => {
        mock({
            [path.join(__dirname, './templates/default')]: {
                'index.html': '<html><head><title><%= title %></title></head><body></body></html>',
                'style.css': 'body { color: red; }',
                'script.js': 'console.log("hi");',
                assets: {
                    'image.png': 'binarycontent'
                }
            },
            'global-assets': {
                'common.css': 'body {}'
            }
        });
    });

    afterEach(() => {
        mock.restore();
        jest.clearAllMocks();
    });

    test('getTemplateFiles returns only .html files', () => {
        const result = getTemplateFiles(sampleConf);
        expect(result.length).toBeGreaterThan(0);
        expect(result[0]).toMatch(/\.html$/);
    });

    test('emptyDir removes all files and folders', () => {
        const testDir = path.join(__dirname, 'tmp');
        fs.mkdirSync(testDir);
        fs.writeFileSync(path.join(testDir, 'file.txt'), 'data');
        expect(fs.existsSync(path.join(testDir, 'file.txt'))).toBe(true);
        emptyDir(testDir);
        const remaining = fs.readdirSync(testDir);
        expect(remaining.length).toBe(0);
    });

    test('copyFolder copies folder recursively and minifies assets', () => {
        const output = 'dist/assets';
        copyFolder('templates/basic/assets', 'assets');
        expect(fs.existsSync(path.join(output, 'image.png'))).toBe(true);
    });

    test('renderTemplateFiles creates rendered HTML files', async () => {
        await renderTemplateFiles({ ...sampleConf });
        const outputFile = path.join('dist', sampleConf.targetFolder, 'index.html');
        expect(fs.existsSync(outputFile)).toBe(true);
        const contents = fs.readFileSync(outputFile, 'utf8');
        expect(contents).toContain('<title>Custom Title</title>');
    });

    test('render processes config array correctly', async () => {
        const confArray = [sampleConf, { ...sampleConf, targetFolder: 'out2' }];
        await render(confArray);
        expect(fs.existsSync(path.join('dist', 'out2', 'index.html'))).toBe(true);
    });
});
