import { StoreUpdateMeta } from '../../common/types';

/**
 * A file that stores common utilities used across different services.
 */

export type CreateMetaFn = (
    tag: string,
    description: string,
    payload?: Record<string, unknown>,
    extra?: Partial<StoreUpdateMeta>
) => StoreUpdateMeta;
