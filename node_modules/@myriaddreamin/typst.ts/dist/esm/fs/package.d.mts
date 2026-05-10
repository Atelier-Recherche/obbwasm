import { PackageRegistry, PackageResolveContext, PackageSpec } from '../internal.types.mjs';
import { WritableAccessModel } from './index.mjs';
export declare class FetchPackageRegistry implements PackageRegistry {
    cache: Map<string, () => string | undefined>;
    constructor(
    /**
     * @internal
     * Access model for internal use only
     */
    am: WritableAccessModel);
    resolvePath(path: PackageSpec): string;
    pullPackageData(path: PackageSpec): Uint8Array | undefined;
    resolve(spec: PackageSpec, context: PackageResolveContext): string | undefined;
}
//# sourceMappingURL=package.d.mts.map