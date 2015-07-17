'use strict';

var fs = require('fs');
var del = require('del');
var mkdirp = require('mkdirp');
var merge = require('merge2');
var assign = require('lodash.assign');
var series = require('stream-series');
var sequence = require('run-sequence');

var path = require("path");
var Builder = require('systemjs-builder');

var gulp = require('gulp');
var debug = require('gulp-debug');
var concat = require('gulp-concat');
var watch = require('gulp-watch');
var sourcemaps = require('gulp-sourcemaps');
var ngAnnotate = require('gulp-ng-annotate');
var uglify = require('gulp-uglify');
var gutil = require('gulp-util');
var htmlmin = require('gulp-htmlmin');
var browsersync = require('browser-sync');
var cache = require('gulp-cached');

var sass = require('gulp-sass');

var inject = require('gulp-inject');
var ts = require('gulp-typescript');
var tslint = require('gulp-tslint');
var source = require("vinyl-source-stream");
var buffer = require("vinyl-buffer");
var plumber = require('gulp-plumber');

var Config = require('./gulpfile.config');
var config = new Config();

var developmentMode = false;


// ------------------------------------------------------------------
// clean
// ------------------------------------------------------------------
gulp.task('clean', function (cb) {
    del([config.target], cb);
});

// ------------------------------------------------------------------
// Build Libraries
// ------------------------------------------------------------------

gulp.task('build:vendor', [], function () {
    var js = [];
    var css = [];
    var rest = [];
    config.vendor.forEach(function (elem) {
        if (elem.substr(-3) === ".js") {
            js.push(elem);
        } else if (elem.substr(-4) === ".css") {
            css.push(elem);
        } else {
            rest.push(elem);
        }
    });
    var streamJs = gulp.src(js)
        .pipe(debug({title: "Including vendor JS:"}))
        .pipe(concat("vendor.js"))
        .pipe(gulp.dest(config.targetApp + "/vendor"));

    var streamCss = gulp.src(css)
        .pipe(debug({title: "Including vendor CSS:"}))
        .pipe(concat("vendor.css"))
        .pipe(gulp.dest(config.targetApp + "/vendor"));

    var streamRest = gulp.src(rest)
        .pipe(debug({title: "Including vendor Asset:"}))
        .pipe(gulp.dest(config.targetApp + "/vendor"));

    var streamSystemJs = gulp.src(
        ["system-polyfills.js", "system.js"],
        {cwd: "node_modules/systemjs/dist"})
        .pipe(gulp.dest(config.targetApp + "/systemjs"));

    if (developmentMode) {
        var entryGenerated = "System.config(";
        entryGenerated += JSON.stringify(config.systemJSConfig);
        entryGenerated += ");\n";
        entryGenerated += "System.import('" + config.systemImportMain + "');";
        mkdirp(config.targetApp + "/systemjs", function () {
            fs.writeFileSync(config.targetApp + "/systemjs/entry-generated.js", entryGenerated);
        });
    }

    return merge(streamJs, streamCss, streamRest, streamSystemJs);
});

// ------------------------------------------------------------------
// Build HTML
// ------------------------------------------------------------------

gulp.task('build:html', [], function () {
    var s = gulp.src("**/*.html", {cwd: config.source});
    s = s.pipe(cache("html"));
    s = s.pipe(debug({title: "HTML:"}));
    s = s.pipe(gulp.dest(config.targetApp));
    s = s.pipe(inject(series(
        gulp.src(
            ["vendor/**/*.js", "vendor/**/*.css"],
            {read: false, cwd: config.targetApp}),

        gulp.src(
            ["systemjs/system.js", "systemjs/system-polyfills.js", "systemjs/entry-generated.js"],
            {read: false, cwd: config.targetApp}),

        gulp.src(
            ['**/*.css', "!vendor/**", "!systemjs/**"],
            {read: false, cwd: config.targetApp})
    ), {relative: true}));
    s = s.pipe(htmlmin({
        collapseWhitespace: true,
        removeComments: true
    }));
    s = s.pipe(gulp.dest(config.targetApp));

    return s;
});


// ------------------------------------------------------------------
// Build CSS
// ------------------------------------------------------------------

gulp.task('build:css', function () {
    var scss = gulp.src(config.scssFiles, {cwd: config.source, nosort: true});
    scss = scss.pipe(cache("scss"));
    scss = developmentMode ? scss.pipe(sourcemaps.init()) : scss;
    scss = scss.pipe(sass().on('error', sass.logError));
    scss = developmentMode ? scss.pipe(sourcemaps.write()) : scss;
    scss = developmentMode ? scss.pipe(gulp.dest(config.targetApp)) : scss;

    var css = gulp.src(config.source + "/**/*.css");
    css = css.pipe(cache("css"));

    var both = merge(scss, css);
    both = both.pipe(debug({title: "CSS:"}));
    both = !developmentMode ? both.pipe(concat("___.css")) : both;
    both = both.pipe(gulp.dest(config.targetApp));
    return both;
});

// ------------------------------------------------------------------
// Build JavaScript
// ------------------------------------------------------------------

function buildJs() {
    var s = gulp.src(config.source + "/**/*.js", {nosort: true});
    s = s.pipe(cache("js"));
    s = developmentMode ? s.pipe(sourcemaps.init()) : s;
    s = s.pipe(ngAnnotate());
    s = s.pipe(uglify());
    s = developmentMode ? s.pipe(sourcemaps.write()) : s;
    s = s.pipe(debug({title: "JavaScript:"}));
    s = s.pipe(gulp.dest(config.targetJs));
    return s;
}

gulp.task('build:js', function () {
    return buildJs();
});


// ------------------------------------------------------------------
// Build TypeScript
// ------------------------------------------------------------------

var tsProject = ts.createProject('tsconfig.json');

gulp.task('build:ts', function () {
    if (developmentMode) {
        gulp.src(config.source + '/**/*.ts')
            .pipe(cache("lint:ts"))
            .pipe(tslint()).pipe(tslint.report('prose', {emitError: false}));
    }

    var tsResult = gulp.src('**/*.ts', {cwd: config.source});

    //tsResult = tsResult.pipe(plumber(function () {
    //    abortBuild = true;
    //}));

    tsResult = developmentMode ? tsResult.pipe(cache("ts")) : tsResult;
    tsResult = developmentMode ? tsResult.pipe(sourcemaps.init()) : tsResult;
    tsResult = tsResult.pipe(debug({title: "TypeScript:"}));
    tsResult = tsResult.pipe(ts(tsProject, undefined, ts.reporter.longReporter()));

    var tsResultJs = tsResult.js
        .pipe(ngAnnotate())
        .pipe(uglify());

    if (developmentMode) {
        tsResultJs = tsResultJs.pipe(sourcemaps.write());
    }

    return merge([
        tsResult.dts.pipe(gulp.dest(config.target + "/dts")),
        tsResultJs.pipe(gulp.dest(config.targetJs + "/"))
    ]);
});


// ------------------------------------------------------------------
// Build Bundle
// ------------------------------------------------------------------

gulp.task('bundle', [], function (done) {

    config.systemJSConfig.baseURL = config.targetJs + "/" + config.systemJSConfig.baseURL;

    new Builder(config.systemJSConfig)
        .buildSFX("app.js", config.targetApp + "/systemjs/entry-generated.js", {minify: false})
        .then(function () {
            done();
        })
        .catch(function (err) {
            console.log('Build error');
            console.log(err);
        });
});


// ------------------------------------------------------------------
// BrowserSync
// ------------------------------------------------------------------

gulp.task('browsersync', ["dev"], function () {
    return browsersync({
        open: false,
        server: {
            baseDir: [config.targetApp]
        },
        port: 9999,
        files: [
            config.targetApp + '/**/*.js',
            config.targetApp + '/**/*.html',
            config.targetApp + '/**/*.css',
            config.targetApp + '/**/*.svg',
            config.targetApp + '/**/*.png',
            config.targetApp + '/**/*.jpg',
            config.targetApp + '/**/*.gif'
        ]
    });
});

// ------------------------------------------------------------------
// Start Tasks
// ------------------------------------------------------------------

gulp.task('watch', ["browsersync"], function () {
    developmentMode = true;
    gulp.watch("src/**/*.ts", ["build:ts"]);

    gulp.watch("src/**/*.js", ["build:js"]);
    gulp.watch("src/**/*.html", ["build:html"]);
    gulp.watch("src/**/*.scss", ["build:css"]);
});

gulp.task('dev', function (callback) {

    config.targetJs = config.targetApp;

    developmentMode = true;
    sequence(
        "clean",
        ["build:vendor", "build:js", "build:ts", "build:css"],
        "build:html",
        callback);
});

gulp.task('dist', function (callback) {

    config.targetJs = config.target + "/tmpJs";

    sequence(
        "clean",
        ["build:vendor", "build:js", "build:ts", "build:css"],
        "bundle",
        "build:html",
        callback);
});

gulp.task('default', ["dist"]);



