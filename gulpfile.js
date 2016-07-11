// Include gulp
var gulp = require('gulp');

// Include Our Plugins
var jshint = require('gulp-jshint');
var sass = require('gulp-sass');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');

// Lint Task
gulp.task('lint', function() {
    return gulp.src('js/*.js')
        .pipe(jshint())
        .pipe(jshint.reporter('default'));
});

// Compile Our Sass
gulp.task('sass', function() {
    return gulp.src('scss/*.scss')
        .pipe(sass())
        .pipe(gulp.dest('dist/css'));
});

// Concatenate & Minify JS
gulp.task('scripts', function() {
    return gulp.src('js/app/*.js')
        .pipe(concat('app.js'))
       // .pipe(rename('app.min.js'))
       // .pipe(uglify())
        .pipe(gulp.dest('dist/js'));
});

// Concatenate & Minify JS vendor libs
gulp.task('vendor', function() {
    return gulp.src('js/lib/vendors/*.js')
        .pipe(concat('vendor.js'))
        .pipe(gulp.dest('dist'))
        .pipe(rename('vendor.min.js'))
        //.pipe(uglify())
        .pipe(gulp.dest('dist/js'));
});

gulp.task('three', function() {
    return gulp.src('js/lib/3d/three.min.js')
        .pipe(concat('three.min.js'))
        .pipe(gulp.dest('dist'))
        //.pipe(uglify())
        .pipe(gulp.dest('dist/js'));
});

gulp.task('canvasrenderer', function() {
    return gulp.src('js/lib/renderers/CanvasRenderer.js')
        .pipe(rename('canvasrenderer.js'))
        .pipe(gulp.dest('dist/js'));
});

gulp.task('projector', function() {
    return gulp.src('js/lib/renderers/Projector.js')
        .pipe(rename('projector.js'))
        .pipe(gulp.dest('dist/js'));
});

gulp.task('css',function(){
    return gulp.src('css/*.css')
        .pipe(concat('app.css'))
        .pipe(gulp.dest('dist/css'));
});

gulp.task('img',function(){
    return gulp.src('img/*')
        .pipe(gulp.dest('dist/img'));
});

gulp.task('html',function(){
    return gulp.src('views/layout/index.html')
        .pipe(gulp.dest('dist/'));
});

// Watch Files For Changes
gulp.task('watch', function() {
    gulp.watch(['js/*.js','css/*.css','views/layout/index.html','gulpfile.js', 'js/app/peer.js', 'js/app/vc.js', 'js/app/main.js'], ['lint', 'scripts']);
    gulp.watch('scss/*.scss', ['sass']);
});

// Default Task
gulp.task('default', ['lint', 'sass', 'scripts','vendor', 'css','img','three','canvasrenderer','projector','html']);
