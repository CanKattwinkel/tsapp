'use strict';

var gulp = require('gulp');
//var debug = require('gulp-debug');
var inject = require('gulp-inject');
var watch = require('gulp-watch');
var ts = require('gulp-typescript');
//var tslint = require('gulp-tslint');
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var merge = require('merge2');
var Config = require('./gulpfile.config');
var concat = require('gulp-concat');
var ngAnnotate = require('gulp-ng-annotate');
var watchify = require('watchify');
var browserify = require('browserify');
var uglify = require('gulp-uglify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var gutil = require('gulp-util');
var assign = require('lodash.assign');
var htmlmin = require('gulp-htmlmin');
var browsersync = require('browser-sync');
var es = require('event-stream');

var config = new Config();

//gulp.task('ts-lint', function () {
//    return gulp.src(config.allTypeScript).pipe(tslint()).pipe(tslint.report('prose'));
//});

// ------------------------------------------------------------------
// clean
// ------------------------------------------------------------------
gulp.task('clean', function (cb) {
    del([config.target], cb);
});

// ------------------------------------------------------------------
// Build HTML
// ------------------------------------------------------------------

function buildHtml(watch) {
    var sources = gulp.src([
        config.target + '/**/*.js',
        config.target + '/**/*.css'
    ], {read: false});

    var s = gulp.src(config.sourceHtml);
    s = watch ? s.pipe(watch(config.sourceHtml)) : s;
    s = s.pipe(gulp.dest(config.target));
    s = s.pipe(es.through(function (data) {

        data = data.pipe(inject(sources));
        data = data.pipe(htmlmin({collapseWhitespace: true}));
        data = data.pipe(gulp.dest(config.target));

    }));

    //s = s.pipe(inject(sources));
    //s = s.pipe(htmlmin({collapseWhitespace: true}));
    //s = s.pipe(gulp.dest(config.target));
    return s;

}

gulp.task('build:html', function () {
    return buildHtml(false);
});

// ------------------------------------------------------------------
// Inject HTML
// ------------------------------------------------------------------

//gulp.task('inject', ["build"], function () {
//    var target = gulp.src(config.target + '/index.html');
//    var sources = gulp.src([
//        config.target + '/**/*.js',
//        config.target + '/**/*.css'
//    ], {read: false});
//
//    return target.pipe(inject(sources))
//        .pipe(gulp.dest(config.target));
//});


// ------------------------------------------------------------------
// Build JavaScript
// ------------------------------------------------------------------

function buildJs(watch) {
    var s = gulp.src(config.sourceJavaScript);
    s = watch ? s.pipe(watch(config.sourceJavaScript)) : s;
    s = s.pipe(ngAnnotate());
    s = s.pipe(uglify());
    s = s.pipe(gulp.dest(config.target));
    return s;
}

gulp.task('build:js', function () {
    return buildJs(false);
});

// ------------------------------------------------------------------
// Build TypeScript
// ------------------------------------------------------------------

var browserifyOpts = assign({}, watchify.args, {
    entries: ["src/main.ts"],
    debug: true
});

var browserifyBundle = browserify(browserifyOpts).plugin('tsify', config.tsSettings);

browserifyBundle.on('log', gutil.log);

function buildTs() {
    return browserifyBundle.bundle()
        .on('error', gutil.log.bind(gutil, 'Browserify Error'))
        .pipe(source('bundle.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(ngAnnotate())
        .pipe(uglify())
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(config.target));
}
gulp.task('build:ts', function () {
    buildTs();
});

// ------------------------------------------------------------------
// BrowserSync
// ------------------------------------------------------------------

browserifyBundle.on('update', buildTs);

gulp.task('browsersync', ["build"], function () {
    browsersync({
        open: false,
        server: {
            baseDir: [config.target]
        },
        port: 9999,
        files: [
            config.target + '/**/*.js',
            config.target + '/**/*.html',
            config.target + '/**/*.css',
            config.target + '/**/*.svg',
            config.target + '/**/*.png',
            config.target + '/**/*.jpg',
            config.target + '/**/*.gif'
        ]
    });
});

// ------------------------------------------------------------------
// Start Tasks
// ------------------------------------------------------------------

gulp.task('watch', ["browsersync"], function () {

    browserifyBundle = watchify(browserifyBundle);
    buildTs();

    buildJs(true);
    buildHtml(true);
});

gulp.task('build', [], function () {
    return merge(
        [buildTs(), buildJs()],
        buildHtml()
    );
});

gulp.task('dist', ['clean'], function () {
});

gulp.task('default', ["watch"]);



