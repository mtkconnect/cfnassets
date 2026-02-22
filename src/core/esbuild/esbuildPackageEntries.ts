import { build, BuildOptions } from 'esbuild';
import { basename } from 'path';
import { ZipAssetEntry } from '../zip/ZipAssetEntry.js';

export async function* esbuildPackageEntries(
  options: BuildOptions,
): AsyncIterableIterator<ZipAssetEntry> {
  const result = await build({
    ...options,
    write: false,
  });

  for (const file of result.outputFiles ?? []) {
    yield {
      archivePath: basename(file.path),
      content: Buffer.from(file.contents),
    };
  }
}
