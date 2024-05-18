const util = require('util'),
  path = require('path'),
  Writable = require('stream').Writable,
  Command = require('../lib/command'),
  { defaultConfig, defaultEsmConfig } = require('../lib/config'),
  fs = require('fs'),
  os = require('os');

function StringWriter(options) {
  if (!(this instanceof StringWriter)) {
    return new StringWriter(options);
  }
  Writable.call(this, options);
  this.output = '';

  this._write = function(chunk, encoding, callback) {
    this.output = this.output + chunk.toString();
    callback();
  };
}
util.inherits(StringWriter, Writable);

describe('Command', function() {
  beforeEach(function() {
    this.writer = new StringWriter();
    this.console = new console.Console(this.writer);
  });

  describe('With no subcommand specified', function() {
    it('runs the serve subcommand', async function() {
      const fakeJasmineBrowser = jasmine.createSpyObj('jasmineBrowser', [
          'startServer',
        ]),
        command = new Command({
          jasmineBrowser: fakeJasmineBrowser,
          console: this.console,
          baseDir: path.resolve(__dirname, 'fixtures/sampleProject'),
        });

      await command.run([]);

      expect(fakeJasmineBrowser.startServer).toHaveBeenCalled();
    });
  });

  describe('serve', () => {
    it('starts a server', async function() {
      const fakeJasmineBrowser = jasmine.createSpyObj('jasmineBrowser', [
          'startServer',
        ]),
        command = new Command({
          jasmineBrowser: fakeJasmineBrowser,
          console: this.console,
          baseDir: path.resolve(__dirname, 'fixtures/sampleProject'),
        });

      await command.run(['serve', '--config=sampleConfig.json']);

      const options = require(path.join(
        __dirname,
        'fixtures/sampleProject/sampleConfig.json'
      ));

      expect(fakeJasmineBrowser.startServer).toHaveBeenCalledWith(options);
    });

    it('finds a default config when serving', async function() {
      const fakeJasmineBrowser = jasmine.createSpyObj('jasmineBrowser', [
          'startServer',
        ]),
        command = new Command({
          jasmineBrowser: fakeJasmineBrowser,
          console: this.console,
          baseDir: path.resolve(__dirname, 'fixtures/sampleProject'),
        });

      await command.run(['serve']);

      const options = require(path.join(
        __dirname,
        'fixtures/sampleProject/spec/support/jasmine-browser.json'
      ));

      expect(fakeJasmineBrowser.startServer).toHaveBeenCalledWith(options);
    });

    it('allows CLI args to override config file when serving', async function() {
      const fakeJasmineBrowser = jasmine.createSpyObj('jasmineBrowser', [
          'startServer',
        ]),
        command = new Command({
          jasmineBrowser: fakeJasmineBrowser,
          console: this.console,
          baseDir: path.resolve(__dirname, 'fixtures/sampleProject'),
        });

      await command.run(['serve', '--config=sampleConfig.json', '--port=2345']);

      const options = require(path.join(
        __dirname,
        'fixtures/sampleProject/sampleConfig.json'
      ));

      options.port = 2345;

      expect(fakeJasmineBrowser.startServer).toHaveBeenCalledWith(options);
    });

    it('propagates errors', async function() {
      const error = new Error('nope'),
        fakeJasmineBrowser = jasmine.createSpyObj('jasmineBrowser', [
          'startServer',
        ]),
        command = new Command({
          jasmineBrowser: fakeJasmineBrowser,
          console: this.console,
          baseDir: path.resolve(__dirname, 'fixtures/sampleProject'),
        });

      fakeJasmineBrowser.startServer.and.callFake(() => Promise.reject(error));

      await expectAsync(command.run(['serve'])).toBeRejectedWith(error);
    });
  });

  describe('runSpecs', function() {
    it('propagates errors', async function() {
      const error = new Error('nope'),
        fakeJasmineBrowser = jasmine.createSpyObj('jasmineBrowser', [
          'runSpecs',
        ]),
        command = new Command({
          jasmineBrowser: fakeJasmineBrowser,
          console: this.console,
          baseDir: path.resolve(__dirname, 'fixtures/sampleProject'),
        });

      fakeJasmineBrowser.runSpecs.and.callFake(() => Promise.reject(error));

      await expectAsync(command.run(['runSpecs'])).toBeRejectedWith(error);
    });

    describe('when --fail-fast is specified', function() {
      it('sets the stopOnSpecFailure and stopSpecOnExpectationFailure env options to true', async function() {
        const fakeJasmineBrowser = jasmine.createSpyObj('jasmineBrowser', [
            'runSpecs',
          ]),
          command = new Command({
            jasmineBrowser: fakeJasmineBrowser,
            console: this.console,
            baseDir: path.resolve(__dirname, 'fixtures/sampleProject'),
          });
        fakeJasmineBrowser.runSpecs.and.returnValue(Promise.resolve());

        await command.run(['runSpecs', '--fail-fast']);

        expect(fakeJasmineBrowser.runSpecs).toHaveBeenCalledWith(
          jasmine.objectContaining({
            env: {
              stopOnSpecFailure: true,
              stopSpecOnExpectationFailure: true,
            },
          })
        );
      });
    });
  });

  describe('version', function() {
    it('reports the version number', async function() {
      const jasmineBrowserVersion = require('../package.json').version;
      const command = new Command({
        jasmineBrowser: {},
        jasmineCore: { version: () => '17.42' },
        console: this.console,
      });

      await command.run(['version']);

      expect(this.writer.output).toContain('jasmine-core v17.42');
      expect(this.writer.output).toContain(
        'jasmine-browser-runner v' + jasmineBrowserVersion
      );
    });
  });

  describe('init', function() {
    beforeEach(function() {
      const tempDir = fs.mkdtempSync(`${os.tmpdir()}/jasmine-browser-command-`);
      this.prevDir = process.cwd();
      process.chdir(tempDir);
    });

    afterEach(function() {
      process.chdir(this.prevDir);
    });

    describe('When spec/support/jasmine-browser.json does not exist', function() {
      describe('and --esm was passed', function() {
        it('creates a config file that works for ES modules', async function() {
          const command = new Command({
            jasmineBrowser: {},
            jasmineCore: {},
            console: this.console,
          });
          await command.run(['init', '--esm']);

          const rawActualContents = fs.readFileSync(
            'spec/support/jasmine-browser.mjs',
            { encoding: 'utf8' }
          );
          expect(rawActualContents).toEqual(defaultEsmConfig());
          const actualContents = (
            await import(
              `file://${process.cwd()}/spec/support/jasmine-browser.mjs`
            )
          ).default;
          expect(actualContents.srcFiles).toEqual([]);
          expect(actualContents.specDir).toEqual('.');
          expect(actualContents.specFiles).toEqual(['spec/**/*[sS]pec.?(m)js']);
          expect(actualContents.helpers).toEqual(['spec/helpers/**/*.?(m)js']);
        });
      });

      describe('and --esm was not passed', function() {
        it('creates a config file that works for regular projects', async function() {
          const command = new Command({
            jasmineBrowser: {},
            jasmineCore: {},
            console: this.console,
          });

          await command.run(['init']);

          const rawActualContents = fs.readFileSync(
            'spec/support/jasmine-browser.mjs',
            { encoding: 'utf8' }
          );
          expect(rawActualContents).toEqual(defaultConfig());
          const actualContents = (
            await import(
              `file://${process.cwd()}/spec/support/jasmine-browser.mjs`
            )
          ).default;
          expect(actualContents.srcDir).toEqual('src');
          expect(actualContents.srcFiles).toEqual(['**/*.js']);
          expect(actualContents.specDir).toEqual('spec');
          expect(actualContents.specFiles).toEqual(['**/*[sS]pec.js']);
          expect(actualContents.helpers).toEqual(['helpers/**/*.js']);
        });
      });
    });

    describe('When spec/support/jasmine-browser.json already exists', function() {
      it('does not create the file', async function() {
        const command = new Command({
          jasmineBrowser: {},
          jasmineCore: {},
          console: this.console,
        });
        fs.mkdirSync('spec/support', { recursive: true });
        fs.writeFileSync(
          'spec/support/jasmine-browser.json',
          'initial contents'
        );

        await command.run(['init']);

        const actualContents = fs.readFileSync(
          'spec/support/jasmine-browser.json',
          { encoding: 'utf8' }
        );
        expect(actualContents).toEqual('initial contents');
      });
    });
  });

  describe('help', function() {
    it('wraps the help text to 80 columns', async function() {
      const command = new Command({
        jasmineBrowser: {},
        jasmineCore: {},
        console: this.console,
      });

      await command.run(['help']);

      const lines = this.writer.output.split('\n');
      expect(lines.length).toBeGreaterThan(0);

      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(80);
      }
    });

    it('includes the --no- prefix for reversable boolean options', async function() {
      const command = new Command({
        jasmineBrowser: {},
        jasmineCore: {},
        console: this.console,
      });

      await command.run(['help']);

      expect(this.writer.output).toContain('--[no-]color');
      expect(this.writer.output).toContain('--[no-]random');
    });

    it('omits the --no- prefix for the fail-fast option', async function() {
      const command = new Command({
        jasmineBrowser: {},
        jasmineCore: {},
        console: this.console,
      });

      await command.run(['help']);

      expect(this.writer.output).toContain('--fail-fast ');
    });
  });
});
