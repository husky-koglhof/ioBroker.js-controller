function VisDebug(options) {
    var fs    = require('fs');
    var tools = require(__dirname + '/../tools.js');
    var path  = require('path');

    // allow use without new operator
    if (!(this instanceof VisDebug)) return new VisDebug(options);

    options = options || {};

    if (!options.objects)           throw "Invalid arguments: objects is missing";
    if (!options.processExit)       throw "Invalid arguments: processExit is missing";

    var objects           = options.objects;
    var processExit       = options.processExit;

    // upload widget directory to vis directory
    function uploadWidgets(dir, adapter, path, callback) {
        var dirs = fs.readdirSync(dir);
        var count = 0;
        for (var d = 0; d < dirs.length; d++) {
            var stat = fs.statSync(dir + '/' + dirs[d]);
            count++;
            if (stat.isDirectory()) {
                uploadWidgets(dir + '/' + dirs[d], adapter, path + '/' + dirs[d], function () {
                    if (!--count && callback) callback();
                });
            } else {
                console.log('Upload "' + dir + '/' + dirs[d] + '"');
                objects.writeFile(adapter, path  + '/' + dirs[d], fs.readFileSync(dir + '/' + dirs[d]), function () {
                    if (!--count && callback) callback();
                });
            }
        }
        if (!count && callback) callback();
    }

    this.enableDebug = function (widgetset) {
        var adapterDir = tools.getAdapterDir('vis-' + widgetset);
        // copy index.html.original to index.html
        // copy edit.html.original to edit.html
        // correct iobroker.json
        // correct config.js
        var visDir = __dirname + '/../../node_modules/iobroker.vis';
        if (!fs.existsSync(visDir)) {
            visDir = __dirname + '/../../node_modules/ioBroker.vis';
            if (!fs.existsSync(visDir)) {
                visDir = __dirname + '/../../../ioBroker.vis';
                if (!fs.existsSync(visDir)) {
                    visDir = __dirname + '/../../../iobroker.vis';
                    if (!fs.existsSync(visDir)) {
                        console.error('Cannot find iobroker.vis');
                        processExit(40);
                    }
                }
            }
        }

        console.log('Upload "' + path.normalize(visDir + '/www/index.html.original') + '"');
        var file = fs.readFileSync(visDir + '/www/index.html.original');
        objects.writeFile('vis', 'index.html', file);

        console.log('Upload "' + path.normalize(visDir + '/www/edit.html.original') + '"');
        file = fs.readFileSync(visDir + '/www/edit.html.original');
        objects.writeFile('vis', 'edit.html', file);

        console.log('Modify "' + path.normalize(visDir + '/www/cache.manifest') + '"');
        file = fs.readFileSync(visDir + '/www/cache.manifest').toString();
        var n = file.match(/# dev build (\d+)/, '5');
        n = n[1];
        file = file.replace('# dev build '+ n, '# dev build ' + (parseInt(n, 10) + 1));
        objects.writeFile('vis', 'cache.manifest', file);

        file = fs.readFileSync(tools.getConfigFileName());
        file = JSON.parse(file);

        var count = 0;
        if (!file.objects.noFileCache) {
            file.objects.noFileCache = true;
            fs.writeFileSync(tools.getConfigFileName(), JSON.stringify(file, null, 2));
            count++;
            objects.enableFileChache(false, function (err, actual) {
                console.log('Disable cache');
                if (!--count) processExit();
            });
        }

        if (widgetset) {
            count++;
            objects.readFile('vis', 'js/config.js', null, function (err, data) {
                data = data.replace(/[\r\n]/g, '');
                var json = JSON.parse(data.match(/"widgetSets":\s(.*)};/)[1]);
                var found = false;
                for (var f = 0; f < json.length; f++) {
                    if (json[f] === widgetset || json[f].name === widgetset) {
                        found = true;
                        break;
                    }
                }
                // if widget-set not found in config.js
                if (!found) {
                    console.log('Modify config.js');
                    var pckg = JSON.parse(fs.readFileSync(adapterDir + '/io-package.json').toString());
                    if (pckg.native && pckg.native.dependencies && pckg.native.dependencies.length){
                        json.push({
                            name: widgetset,
                            depends: pckg.native.dependencies
                        });
                    } else {
                        json.push(widgetset);
                    }

                    data =  data.replace(/"widgetSets":\s+.*};/, '"widgetSets": ' + JSON.stringify(json, null, 2) + '};');

                    objects.writeFile('vis', 'js/config.js', data, function () {
                        // upload all files into vis
                        console.log('Upload ' + adapterDir + '/widgets');
                        uploadWidgets(adapterDir + '/widgets', 'vis', 'widgets', function () {
                            if (!--count) {
                                // timeoout to print all messages
                                setTimeout(function () {
                                    processExit();
                                }, 100);
                            }
                        });
                    });
                } else {
                    // upload all files into vis
                    console.log('Upload "' + adapterDir + '/widgets' + '"');
                    uploadWidgets(adapterDir + '/widgets', 'vis', 'widgets', function () {
                        if (!--count) {
                            // timeoout to print all messages
                            setTimeout(function () {
                                processExit();
                            }, 100);
                        }
                    });
                }

            });
        } else {
            if (!count) processExit();
        }
    };
}

module.exports = VisDebug;
