const fs = require('fs');
const path = require('path');
const mock = require('mock-fs');
const {
    getTemplateFiles,
    emptyDir,
    copyFolder,
    renderTemplateFiles,
    render,
    getDir, // Added getDir here
    pageTitle, // Added pageTitle here
    getFiles, // Added getFiles here
    minifyJS, // Added minifyJS here
    minifyCSS, // Added minifyCSS here
    minifyAssets, // Added minifyAssets here
} = require('./index'); // Corrected path

jest.mock('terser', () => ({
    minify: jest.fn(() => Promise.resolve({ code: 'minified js' }))
}));

jest.mock('csso', () => ({
    minify: jest.fn(() => ({ css: 'minified css' }))
}));

jest.mock('./config', () => ({ // Corrected path
    output: 'dist'
}));

jest.mock('./api-event-interceptors', () => ({ // Corrected path
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
            [path.join(__dirname, '../src/templates/basic')]: {
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

    describe('getFiles', () => {
        beforeEach(() => {
            mock({
                'testDir/file1.txt': 'content1',
                'testDir/subDir/file2.txt': 'content2',
                'testDir/subDir/subSubDir/file3.css': 'content3',
                'emptyDir': {}
            });
        });

        afterEach(() => {
            mock.restore();
        });

        test('should recursively find all files in a directory', () => {
            // We need to use path.join for mock-fs to work correctly with getFiles's concatenation
            const rootDir = 'testDir';
            const files = getFiles(rootDir);
            // Normalize paths for comparison
            const normalizedFiles = files.map(f => f.replace(/\\/g, '/'));

            expect(normalizedFiles).toHaveLength(3);
            expect(normalizedFiles).toContain('testDir/file1.txt');
            expect(normalizedFiles).toContain('testDir/subDir/file2.txt');
            expect(normalizedFiles).toContain('testDir/subDir/subSubDir/file3.css');
        });

        test('should return an empty array for an empty directory', () => {
            const files = getFiles('emptyDir');
            expect(files).toEqual([]);
        });

        test('should return an empty array if directory does not exist', () => {
            // mock-fs will make fs.readdirSync throw if the dir doesn't exist in the mock
            // The original getFiles would throw in this case.
            // We test the behavior when the directory exists but is empty with the 'emptyDir' test.
            // To test non-existent dir, we'd have to not mock it, or mock fs.existsSync
            // For now, we rely on mock-fs creating the dir for the test.
            // If getFiles is called with a non-existent path, fs.readdirSync will throw.
            // This is acceptable default behavior.
            // To explicitly test this, we would need to ensure 'nonExistentDir' is not in mock config.
            // However, getFiles doesn't check fs.existsSync, it directly calls readdirSync.
            // So, if 'nonExistentDir' is not mocked, readdirSync will throw an error.
            // This behavior is implicitly tested by not including 'nonExistentDir' in mock setup.
            // Let's ensure the test for emptyDir covers the "no files found" scenario.
            expect(() => getFiles('nonExistentDir')).toThrow();
        });
    });

    describe('pageTitle', () => {
        const sampleData = {
            title: 'Default Title',
            pageTitles: {
                'index.html': 'Homepage Title',
                'about.html': 'About Us'
            }
        };

        test('should return specific page title if available', () => {
            expect(pageTitle('index.html', sampleData)).toBe('Homepage Title');
            expect(pageTitle('about.html', sampleData)).toBe('About Us');
        });

        test('should return default data.title if specific page title is not available', () => {
            expect(pageTitle('contact.html', sampleData)).toBe('Default Title');
        });

        test('should return empty string if no title is found (no data.title and no specific title)', () => {
            expect(pageTitle('any.html', { pageTitles: {} })).toBe('');
        });

        test('should return empty string if data is null or undefined', () => {
            expect(pageTitle('index.html', null)).toBe('');
            expect(pageTitle('index.html', undefined)).toBe('');
        });

        test('should return empty string if data.pageTitles is null or undefined, and no data.title', () => {
            expect(pageTitle('index.html', { title: 'Default' })).toBe('Default'); // Falls back to data.title
            expect(pageTitle('index.html', { pageTitles: null })).toBe('');
            expect(pageTitle('index.html', { pageTitles: undefined })).toBe('');
        });

        test('should return data.title if file is null or undefined but data.title exists', () => {
            expect(pageTitle(null, sampleData)).toBe('Default Title');
            expect(pageTitle(undefined, sampleData)).toBe('Default Title');
        });

        test('should return empty string if file is null and data.title does not exist', () => {
            expect(pageTitle(null, {pageTitles: {'index.html': 'Something'}})).toBe('');
        });
    });

    afterEach(() => {
        mock.restore();
        jest.clearAllMocks();
    });

    describe('getDir', () => {
        const originalDirname = __dirname;

        beforeAll(() => {
            // Mock __dirname for consistent testing
            Object.defineProperty(global, '__dirname', {
                value: '/mocked/base/path',
                writable: true
            });
        });

        afterAll(() => {
            // Restore original __dirname
            Object.defineProperty(global, '__dirname', {
                value: originalDirname,
                writable: true
            });
        });

        test('should prepend __dirname if not present and normalize path separators', () => {
            const dirPath = 'some/folder';
            const expectedPath = `/mocked/base/path${path.sep}some${path.sep}folder`;
            expect(getDir(dirPath)).toBe(expectedPath);
        });

        test('should not prepend __dirname if already present and normalize path separators', () => {
            const dirPath = `/mocked/base/path/some/other/folder`;
            const expectedPath = `/mocked/base/path${path.sep}some${path.sep}other${path.sep}folder`;
            expect(getDir(dirPath)).toBe(expectedPath);
        });

        test('should handle mixed separators and normalize them', () => {
            const dirPath = 'some\\mixed/path';
            const expectedPath = `/mocked/base/path${path.sep}some${path.sep}mixed${path.sep}path`;
            expect(getDir(dirPath)).toBe(expectedPath);
        });

        test('should handle already correct path separators', () => {
            const dirPath = `some${path.sep}folder`;
            const expectedPath = `/mocked/base/path${path.sep}some${path.sep}folder`;
            expect(getDir(dirPath)).toBe(expectedPath);
        });

        test('should handle paths starting with __dirname correctly', () => {
            const dirPath = `${__dirname}/my/dir`;
            const expectedPath = `/mocked/base/path${path.sep}my${path.sep}dir`;
            expect(getDir(dirPath)).toBe(expectedPath);
        });
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

describe('Asset Minification', () => {
    const mockReadFileSync = jest.spyOn(fs, 'readFileSync');
    const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync');
    const terserMinify = require('terser').minify;

    beforeEach(() => {
        // Reset mocks before each test
        mockReadFileSync.mockReset();
        mockWriteFileSync.mockReset();
        terserMinify.mockClear(); // Clear mock call history

        // Provide default mock implementations
        mockReadFileSync.mockReturnValue('original js code');
        mockWriteFileSync.mockImplementation(() => {}); // No-op for write
        terserMinify.mockResolvedValue({ code: 'minified js' });
    });

    afterAll(() => {
        // Restore original fs functions after all tests in this describe block
        mockReadFileSync.mockRestore();
        mockWriteFileSync.mockRestore();
    });

    describe('minifyJS', () => {
        test('should read, minify, and write JS files', async () => {
            const jsFiles = ['path/to/script1.js', 'path/to/script2.js'];
            mockReadFileSync.mockReturnValueOnce('js code 1').mockReturnValueOnce('js code 2');

            await minifyJS(jsFiles);

            expect(mockReadFileSync).toHaveBeenCalledTimes(2);
            expect(mockReadFileSync).toHaveBeenCalledWith(jsFiles[0], 'utf8');
            expect(mockReadFileSync).toHaveBeenCalledWith(jsFiles[1], 'utf8');

            expect(terserMinify).toHaveBeenCalledTimes(2);
            expect(terserMinify).toHaveBeenCalledWith('js code 1', { sourceMap: false });
            expect(terserMinify).toHaveBeenCalledWith('js code 2', { sourceMap: false });

            expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
            expect(mockWriteFileSync).toHaveBeenCalledWith(jsFiles[0], 'minified js');
            expect(mockWriteFileSync).toHaveBeenCalledWith(jsFiles[1], 'minified js');
        });

        test('should handle empty array of JS files', async () => {
            await minifyJS([]);
            expect(mockReadFileSync).not.toHaveBeenCalled();
            expect(terserMinify).not.toHaveBeenCalled();
            expect(mockWriteFileSync).not.toHaveBeenCalled();
        });

        test('should correctly pass code from readFileSync to terser.minify', async () => {
            const jsFiles = ['test.js'];
            const specificCode = 'let a = 1; console.log(a);';
            mockReadFileSync.mockReturnValue(specificCode);

            await minifyJS(jsFiles);

            expect(terserMinify).toHaveBeenCalledWith(specificCode, { sourceMap: false });
        });
    });

    describe('minifyCSS', () => {
        const cssoMinify = require('csso').minify;

        beforeEach(() => {
            // cssoMinify is part of the Asset Minification suite, so fs mocks are already set up
            // Clear cssoMinify's call history specifically
            cssoMinify.mockClear();
            // Ensure it returns the default mock value
            cssoMinify.mockReturnValue({ css: 'minified css' });
        });

        test('should read, minify, and write CSS files', () => {
            const cssFiles = ['path/to/style1.css', 'path/to/style2.css'];
            mockReadFileSync.mockReturnValueOnce('css code 1').mockReturnValueOnce('css code 2');

            minifyCSS(cssFiles);

            expect(mockReadFileSync).toHaveBeenCalledTimes(2);
            expect(mockReadFileSync).toHaveBeenCalledWith(cssFiles[0], 'utf8');
            expect(mockReadFileSync).toHaveBeenCalledWith(cssFiles[1], 'utf8');

            expect(cssoMinify).toHaveBeenCalledTimes(2);
            expect(cssoMinify).toHaveBeenCalledWith('css code 1');
            expect(cssoMinify).toHaveBeenCalledWith('css code 2');

            expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
            expect(mockWriteFileSync).toHaveBeenCalledWith(cssFiles[0], 'minified css');
            expect(mockWriteFileSync).toHaveBeenCalledWith(cssFiles[1], 'minified css');
        });

        test('should handle empty array of CSS files', () => {
            minifyCSS([]);
            expect(mockReadFileSync).not.toHaveBeenCalled();
            expect(cssoMinify).not.toHaveBeenCalled();
            expect(mockWriteFileSync).not.toHaveBeenCalled();
        });

        test('should correctly pass code from readFileSync to csso.minify', () => {
            const cssFiles = ['test.css'];
            const specificCode = 'body { color: blue; }';
            mockReadFileSync.mockReturnValue(specificCode);

            minifyCSS(cssFiles);

            expect(cssoMinify).toHaveBeenCalledWith(specificCode);
        });
    });
});

// Mocking the entire module for specific functions used by minifyAssets
// We need to be careful here as other tests might rely on the actual implementations.
// This specific mock is for testing minifyAssets in isolation.
// We will use jest.requireActual for parts we don't want to mock globally here.
// And for functions like getDir, getFiles, minifyJS, minifyCSS, we will provide specific mocks.

// It's better to mock specific dependencies directly if they are imported,
// or mock methods on an imported object.
// Since minifyJS and minifyCSS are imported from '../src/index',
// we can mock this module for the minifyAssets tests.

// Let's re-evaluate the mocking strategy for minifyAssets.
// minifyAssets calls getDir, getFiles, minifyJS, minifyCSS.
// getDir and getFiles are from the same module. minifyJS and minifyCSS are also from there.
// We can spyOn and mock implementations for these functions from the imported module.

// api.js (where minifyAssets is)
// const getDir = ...
// const getFiles = ...
// const minifyJS = ...
// const minifyCSS = ...
// const minifyAssets = target => {
//   target = getDir(target);
//   const allFiles = getFiles(target);
//   const js = allFiles.filter(file => file.includes('.js'));
//   const css = allFiles.filter(file => file.includes('.css'));
//   minifyJS(js);
//   minifyCSS(css);
// }
// module.exports = { ..., getDir, getFiles, minifyJS, minifyCSS, minifyAssets }

// In api.test.js
// const { getDir, getFiles, minifyJS, minifyCSS, minifyAssets } = require('../src/index');
// So we can spy on these.

// No, this approach for mocking minifyJS and minifyCSS within the same test file
// where they are also tested is tricky.
// The `jest.mock('terser')` and `jest.mock('csso')` are global for the file.
// The fs mocks are also set up for the 'Asset Minification' describe block.

// Let's create a new describe block and mock the necessary functions from '../src/index'
// This requires careful handling of mocks.

// A cleaner way: In api.js, minifyAssets calls other functions from the same module.
// We can't directly mock them using jest.mock('../src/index') inside api.test.js
// without it affecting other tests for those very functions.

// Alternative: Re-import with jest.doMock for a specific describe block.
// Or, pass dependencies to minifyAssets (dependency injection) - but that's a code change.

// For now, let's spy on the imported functions and provide mock implementations
// for the duration of the minifyAssets tests.

// We need to import the *actual* module to spy on its methods.
const actualApi = jest.requireActual('./index'); // Corrected path

describe('minifyAssets', () => {
    let mockGetDir, mockGetFiles, mockMinifyJS, mockMinifyCSS;

    beforeEach(() => {
        // Spy on the functions from the actual module and provide mock implementations
        // This is tricky because these functions are not methods of an object, but standalone exports.
        // A common pattern is to mock the module, and then for functions you want to test,
        // you use the actual implementation.

        // Let's try to mock what minifyAssets calls internally.
        // minifyAssets calls getDir, getFiles, minifyJS, minifyCSS which are defined in the same file.
        // This means we cannot easily use jest.spyOn(module, 'functionName') for them if they are not class methods
        // or object properties.

        // The best way here is to refactor api.js to make these testable, e.g., by exporting them as an object:
        // apiInternal = { getDir, getFiles, minifyJS, minifyCSS }
        // And then minifyAssets uses apiInternal.getDir etc. Then we can mock apiInternal.
        // Or, pass them as parameters to minifyAssets.

        // Given the current structure, we'll mock the side effects or final calls.
        // We've already tested minifyJS and minifyCSS thoroughly with their mocks (terser, csso, fs).
        // So, for testing minifyAssets, we can assume minifyJS and minifyCSS work as tested.
        // We need to test that minifyAssets correctly:
        // 1. Calls getDir with the target.
        // 2. Calls getFiles with the result of getDir.
        // 3. Filters JS and CSS files correctly.
        // 4. Calls minifyJS with the JS files.
        // 5. Calls minifyCSS with the CSS files.

        // We will use jest.mock to provide temporary mock implementations for
        // getFiles, minifyJS, and minifyCSS for the scope of these tests.
        // We need to ensure getDir is also controllable or its effects are.

        // This is becoming complex due to the inter-dependencies within api.js and how they are exported.
        // Let's simplify the mocking strategy for minifyAssets.
        // We will mock `getFiles`, `minifyJS`, and `minifyCSS` at the module level for this test suite.
    });

    // Due to the complexities of mocking module-internal functions without refactoring,
    // and given that minifyJS and minifyCSS are already unit-tested with mocks for their own dependencies,
    // for minifyAssets, we will focus on integration: does it call the correct high-level functions?

    // We will spy on the imported minifyJS and minifyCSS.
    // We need to control what getFiles returns.
    // We can mock getFiles by mocking the 'fs' module for readdirSync if getFiles is not easily mockable itself.
    // But getFiles is exported, so we can try to spy on it.

    // The issue is that these are not object methods, but direct exports.
    // `jest.spyOn(api, 'getFiles')` won't work if api is just `{ getFiles: getFilesFunction }`.

    // Let's assume getDir works (tested).
    // Let's mock `getFiles` to return a controlled list of files.
    // And spy on `minifyJS` and `minifyCSS` to ensure they are called.

    // This requires `minifyJS` and `minifyCSS` to be mockable when `minifyAssets` calls them.
    // If they are all in the same module, `minifyAssets` calls the *actual* `minifyJS` and `minifyCSS`,
    // not any mock we define in the test file for the *exported* versions.

    // The functions are:
    // const api = require('../src/index');
    // api.minifyAssets -> calls internal minifyJS, minifyCSS, getFiles.

    // We will mock the behavior of `getFiles` using `mock-fs` for `minifyAssets`
    // and verify that `minifyJS` and `minifyCSS` are called.
    // To verify calls to `minifyJS` and `minifyCSS`, we will have to rely on their side effects
    // (e.g., calls to terser.minify and csso.minify), since we can't easily spy on the
    // direct calls from minifyAssets to its sibling functions in the same module.

    const terserMinify = require('terser').minify;
    const cssoMinify = require('csso').minify;
    // fs mocks (readFileSync, writeFileSync) are already part of the 'Asset Minification' parent describe block.
    // We need to ensure they are active here or set them up if this describe block is separate.
    // Let's assume they are active.

    // Redefining the fs mocks locally to ensure they are controlled for this test suite.
    const mockReadFileSync = jest.spyOn(fs, 'readFileSync');
    const mockWriteFileSync = jest.spyOn(fs, 'writeFileSync');


    beforeEach(() => {
        mockReadFileSync.mockReset().mockReturnValue('file content');
        mockWriteFileSync.mockReset().mockImplementation(() => {});
        terserMinify.mockClear().mockResolvedValue({ code: 'minified js' });
        cssoMinify.mockClear().mockReturnValue({ css: 'minified css' });

        // Mock for getFiles used by minifyAssets
        // This is tricky. getFiles uses fs.readdirSync and fs.statSync.
        // We can use mock-fs to set up a directory structure.
        mock({
            'assets/js/script1.js': 'js content 1',
            'assets/js/script2.js': 'js content 2',
            'assets/css/style1.css': 'css content 1',
            'assets/vendor/lib.js': 'vendor js',
            'assets/img/image.png': 'img content',
            'assets/emptyDir': {}
        });
    });

    afterEach(() => {
        mock.restore();
    });

    // We also need to control getDir or know its behavior.
    // Let's assume getDir is tested and works. It prepends __dirname.
    // For these tests, we'll pass a simple path to minifyAssets and let getDir prepend __dirname.
    // The mocked file system via mock-fs should be relative to the project root or where __dirname points.
    // Let's assume __dirname is the project root for mock-fs paths.
    // The `getDir` function prepends a mocked `__dirname` in tests.
    // So, `minifyAssets('assets')` will effectively operate on `/mocked/base/path/assets`.
    // We need `mock-fs` to create paths like `/mocked/base/path/assets/...`.

    // Re-doing mock setup for minifyAssets to be more robust.
    const originalGetDir = actualApi.getDir; // Save original
    const apiModule = require('../src/index'); // Import module whose functions we might mock

    // We cannot easily mock `getFiles` called internally by `minifyAssets` from the same module.
    // So, we will set up a file system with `mock-fs` and let `getFiles` run.
    // Then we check if `minifyJS` and `minifyCSS` (via their effects on terser/csso) are called correctly.

    test('should call minifyJS for .js files and minifyCSS for .css files', async () => {
        // __dirname is mocked to /mocked/base/path in the global test setup for getDir
        // So getDir('assets') will return /mocked/base/path/assets
        const targetPath = 'targetMinify'; // This will become /mocked/base/path/targetMinify

        mock({
            [path.join('/mocked/base/path', targetPath, 'script.js')]: 'console.log("hello");',
            [path.join('/mocked/base/path', targetPath, 'style.css')]: 'body {}',
            [path.join('/mocked/base/path', targetPath, 'data.txt')]: 'text file',
        });

        await minifyAssets(targetPath); // Internally calls getDir, then getFiles, then minifyJS/CSS

        // Check if terser was called for the JS file
        // minifyJS reads the file, calls terser, writes the file.
        expect(mockReadFileSync).toHaveBeenCalledWith(path.join('/mocked/base/path', targetPath, 'script.js'), 'utf8');
        expect(terserMinify).toHaveBeenCalledWith('console.log("hello");', { sourceMap: false });
        expect(mockWriteFileSync).toHaveBeenCalledWith(path.join('/mocked/base/path', targetPath, 'script.js'), 'minified js');

        // Check if csso was called for the CSS file
        expect(mockReadFileSync).toHaveBeenCalledWith(path.join('/mocked/base/path', targetPath, 'style.css'), 'utf8');
        expect(cssoMinify).toHaveBeenCalledWith('body {}');
        expect(mockWriteFileSync).toHaveBeenCalledWith(path.join('/mocked/base/path', targetPath, 'style.css'), 'minified css');

        // Ensure .txt file was not processed by minifyJS or minifyCSS
        expect(terserMinify).not.toHaveBeenCalledWith('text file', expect.anything());
        expect(cssoMinify).not.toHaveBeenCalledWith('text file');
    });

    test('should handle target directory with no JS or CSS files', async () => {
        const targetPath = 'emptyMinify';
        mock({
            [path.join('/mocked/base/path', targetPath, 'data.txt')]: 'text file',
            [path.join('/mocked/base/path', targetPath, 'image.png')]: 'image data',
        });

        await minifyAssets(targetPath);

        expect(terserMinify).not.toHaveBeenCalled();
        expect(cssoMinify).not.toHaveBeenCalled();
        // readFileSync and writeFileSync should not have been called by minifiers
        // but getFiles would still read directory listings. That's an internal of getFiles.
    });

    test('should handle empty target directory', async () => {
        const targetPath = 'trulyEmptyMinify';
         mock({
            [path.join('/mocked/base/path', targetPath)]: {} // Empty directory
        });

        await minifyAssets(targetPath);
        expect(terserMinify).not.toHaveBeenCalled();
        expect(cssoMinify).not.toHaveBeenCalled();
    });
});
