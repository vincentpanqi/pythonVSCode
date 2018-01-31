import { inject, injectable } from 'inversify';
import * as _ from 'lodash';
import * as path from 'path';
import { Uri } from 'vscode';
import { fsExistsAsync, IS_WINDOWS } from '../../../common/utils';
import { IServiceContainer } from '../../../ioc/types';
import { IInterpreterLocatorService, IInterpreterVersionService, IKnownSearchPathsForInterpreters, InterpreterType, PythonInterpreter } from '../../contracts';
import { lookForInterpretersInDirectory } from '../helpers';
import { CacheableLocatorService } from './cacheableLocatorService';

// tslint:disable-next-line:no-require-imports no-var-requires
const untildify = require('untildify');

@injectable()
export class KnownPathsService extends CacheableLocatorService {
    public constructor( @inject(IKnownSearchPathsForInterpreters) private knownSearchPaths: string[],
        @inject(IInterpreterVersionService) private versionProvider: IInterpreterVersionService,
        @inject(IServiceContainer) serviceContainer: IServiceContainer) {
        super('KnownPathsService', true, serviceContainer);
    }
    // tslint:disable-next-line:no-empty
    public dispose() { }
    protected getInterpretersImplementation(resource?: Uri): Promise<PythonInterpreter[]> {
        return this.suggestionsFromKnownPaths();
    }
    private suggestionsFromKnownPaths() {
        const promises = this.knownSearchPaths.map(dir => this.getInterpretersInDirectory(dir));
        return Promise.all<string[]>(promises)
            // tslint:disable-next-line:underscore-consistent-invocation
            .then(listOfInterpreters => _.flatten(listOfInterpreters))
            .then(interpreters => interpreters.filter(item => item.length > 0))
            .then(interpreters => Promise.all(interpreters.map(interpreter => this.getInterpreterDetails(interpreter))));
    }
    private getInterpreterDetails(interpreter: string) {
        return this.versionProvider.getVersion(interpreter, path.basename(interpreter))
            .then(displayName => {
                return {
                    displayName,
                    path: interpreter,
                    type: InterpreterType.Unknown
                };
            });
    }
    private getInterpretersInDirectory(dir: string) {
        return fsExistsAsync(dir)
            .then(exists => exists ? lookForInterpretersInDirectory(dir) : Promise.resolve<string[]>([]));
    }
}

export function getKnownSearchPathsForInterpreters(): string[] {
    if (IS_WINDOWS) {
        return [];
    } else {
        const paths = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin'];
        paths.forEach(p => {
            paths.push(untildify(`~${p}`));
        });
        // Add support for paths such as /Users/xxx/anaconda/bin.
        if (process.env.HOME) {
            paths.push(path.join(process.env.HOME, 'anaconda', 'bin'));
            paths.push(path.join(process.env.HOME, 'python', 'bin'));
        }
        return paths;
    }
}
