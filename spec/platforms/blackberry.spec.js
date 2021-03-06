var blackberry = require('../../src/platforms/blackberry'),
    common  = require('../../src/platforms/common'),
    install = require('../../src/install'),
    path    = require('path'),
    fs      = require('fs'),
    shell   = require('shelljs'),
    et      = require('elementtree'),
    os      = require('osenv'),
    temp    = path.join(os.tmpdir(), 'plugman'),
    plugins_dir = path.join(temp, 'cordova', 'plugins'),
    xml_helpers = require('../../src/util/xml-helpers'),
    plugins_module = require('../../src/util/plugins'),
    dummyplugin = path.join(__dirname, '..', 'plugins', 'DummyPlugin'),
    faultyplugin = path.join(__dirname, '..', 'plugins', 'FaultyPlugin'),
    blackberry_project = path.join(__dirname, '..', 'projects', 'blackberry', '*');

var xml_path     = path.join(dummyplugin, 'plugin.xml')
  , xml_text     = fs.readFileSync(xml_path, 'utf-8')
  , plugin_et    = new et.ElementTree(et.XML(xml_text));

var platformTag = plugin_et.find('./platform[@name="blackberry"]');
var dummy_id = plugin_et._root.attrib['id'];
var valid_source = platformTag.findall('./source-file'),
    assets = plugin_et.findall('./asset'),
    configChanges = platformTag.findall('./config-file');

xml_path  = path.join(faultyplugin, 'plugin.xml')
xml_text  = fs.readFileSync(xml_path, 'utf-8')
plugin_et = new et.ElementTree(et.XML(xml_text));

platformTag = plugin_et.find('./platform[@name="blackberry"]');
var invalid_source = platformTag.findall('./source-file');
var faulty_id = plugin_et._root.attrib['id'];

function copyArray(arr) {
    return Array.prototype.slice.call(arr, 0);
}

describe('blackberry project handler', function() {
    it('should have an install function', function() {
        expect(typeof blackberry.install).toEqual('function');
    });
    it('should have an uninstall function', function() {
        expect(typeof blackberry.uninstall).toEqual('function');
    });
    it('should return cordova-blackberry project www location using www_dir', function() {
        expect(blackberry.www_dir('/')).toEqual('/www');
    });

    describe('installation', function() {
        beforeEach(function() {
            shell.mkdir('-p', temp);
            shell.cp('-rf', blackberry_project, temp);
        });
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        describe('of <source-file> elements', function() {
            it('should copy stuff from one location to another by calling common.straightCopy', function() {
                var source = copyArray(valid_source);
                var s = spyOn(common, 'straightCopy');
                blackberry.install(source, dummy_id, temp, dummyplugin, {});
                expect(s).toHaveBeenCalledWith(dummyplugin, 'src/blackberry/client.js', temp, 'ext-qnx/cordova.echo/client.js');
                expect(s).toHaveBeenCalledWith(dummyplugin, 'src/blackberry/index.js', temp, 'ext-qnx/cordova.echo/index.js');
                expect(s).toHaveBeenCalledWith(dummyplugin, 'src/blackberry/manifest.json', temp, 'ext-qnx/cordova.echo/manifest.json');
            });
            it('should throw if source file cannot be found', function() {
                var source = copyArray(invalid_source);
                expect(function() {
                    blackberry.install(source, faulty_id, temp, faultyplugin, {});
                }).toThrow('"' + path.resolve(faultyplugin, 'src/blackberry/device/echoJnext.so') + '" not found!');
            });
            it('should throw if target file already exists', function() {
                // write out a file
                var target = path.resolve(temp, 'ext-qnx/cordova.echo');
                shell.mkdir('-p', target);
                target = path.join(target, 'client.js');
                fs.writeFileSync(target, 'some bs', 'utf-8');

                var source = copyArray(valid_source);
                expect(function() {
                    blackberry.install(source, dummy_id, temp, dummyplugin, {});
                }).toThrow('"' + target + '" already exists!');
            });
        });
        describe('of <config-file> elements', function() {
            it('should target config.xml', function() {
                var config = copyArray(configChanges);
                var s = spyOn(xml_helpers, 'parseElementtreeSync').andCallThrough();
                blackberry.install(config, dummy_id, temp, dummyplugin, {});
                expect(s).toHaveBeenCalledWith(path.join(temp, 'www', 'config.xml'));
            });
            it('should call into xml helper\'s graftXML', function() {
                shell.cp('-rf', blackberry_project, temp);
                var config = copyArray(configChanges);
                var s = spyOn(xml_helpers, 'graftXML').andReturn(true);
                blackberry.install(config, dummy_id, temp, dummyplugin, {});
                expect(s).toHaveBeenCalled();
            });
        });
    });

    describe('uninstallation', function() {
        beforeEach(function() {
            shell.mkdir('-p', temp);
            shell.mkdir('-p', plugins_dir);
            shell.cp('-rf', blackberry_project, temp);
            shell.cp('-rf', dummyplugin, plugins_dir);
        });
        afterEach(function() {
            shell.rm('-rf', temp);
        });
        describe('of <source-file> elements', function() {
            it('should remove stuff by calling common.deleteJava', function(done) {
                var s = spyOn(common, 'deleteJava');
                install('blackberry', temp, 'DummyPlugin', plugins_dir, {}, function() {
                    var source = copyArray(valid_source);
                    blackberry.uninstall(source, dummy_id, temp, path.join(plugins_dir, 'DummyPlugin'));
                    expect(s).toHaveBeenCalledWith(temp, 'ext-qnx/cordova.echo/client.js');
                    expect(s).toHaveBeenCalledWith(temp, 'ext-qnx/cordova.echo/index.js');
                    expect(s).toHaveBeenCalledWith(temp, 'ext-qnx/cordova.echo/manifest.json');
                    done();
                });
            });
        });
        describe('of <config-file> elements', function() {
            it('should target config.xml', function(done) {
                var config = copyArray(configChanges);
                var s = spyOn(xml_helpers, 'parseElementtreeSync').andCallThrough();
                install('blackberry', temp, 'DummyPlugin', plugins_dir, {}, function() {
                    var config = copyArray(configChanges);
                    blackberry.uninstall(config, dummy_id, temp, path.join(plugins_dir, 'DummyPlugin'));
                    expect(s).toHaveBeenCalledWith(path.join(temp, 'www', 'config.xml'));
                    done();
                });
            });
            it('should call into xml helper\'s pruneXML', function(done) {
                var config = copyArray(configChanges);
                install('blackberry', temp, 'DummyPlugin', plugins_dir, {}, function() {
                    var s = spyOn(xml_helpers, 'pruneXML').andReturn(true);
                    blackberry.uninstall(config, dummy_id, temp, path.join(plugins_dir, 'DummyPlugin'));
                    expect(s).toHaveBeenCalled();
                    done();
                });
            });
        });
        describe('of <asset> elements', function() {
            it('should remove www\'s plugins/<plugin-id> directory', function(done) {
                var as = copyArray(assets);
                install('blackberry', temp, 'DummyPlugin', plugins_dir, {}, function() {
                    var s = spyOn(shell, 'rm');
                    blackberry.uninstall(as, dummy_id, temp, path.join(plugins_dir, 'DummyPlugin'));
                    expect(s).toHaveBeenCalledWith('-rf', path.join(temp, 'www', 'plugins', dummy_id));
                    done();
                });
            });
            it('should remove stuff specified by the element', function(done) {
                var as = copyArray(assets);
                install('blackberry', temp, 'DummyPlugin', plugins_dir, {}, function() {
                    var s = spyOn(shell, 'rm');
                    blackberry.uninstall(as, dummy_id, temp, path.join(plugins_dir, 'DummyPlugin'));
                    expect(s).toHaveBeenCalledWith('-rf', path.join(temp, 'www', 'dummyplugin.js'));
                    expect(s).toHaveBeenCalledWith('-rf', path.join(temp, 'www', 'dummyplugin'));
                    done();
                });
            });
        });
    });
});
