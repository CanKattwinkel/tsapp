'use strict';
var GulpConfig = (function () {
    function GulpConfig() {

        this.source = './src/';
        this.allJavaScript = this.source + '/**/*.js';
        this.allTypeScript = this.source + '/**/*.ts';
        this.allSourceFiles = this.source + '/**/*';


        this.typings = './typings/';
        this.libraryTypeScriptDefinitions = './typings/**/*.ts';

        this.build = './build/';
        this.outputPathJs = this.build + '/js';
        this.tsOutputPathDts = this.build + '/dts';
    }

    return GulpConfig;
})();
module.exports = GulpConfig;
