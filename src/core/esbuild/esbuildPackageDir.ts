import { BuildOptions } from 'esbuild';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname, resolve } from 'path';
import { pipeline } from 'stream/promises';
import { addBundleInfoToPackageJson } from '../../internal/addBundleInfoToPackageJson.js';
import { readDotIgnoreForFolder } from '../../internal/readDotIgnoreForFolder.js';
import { getPackageEntries } from '../zip/getPackageEntries.js';
import { makeZipPackageStream } from '../zip/makeZipPackageStream.js';
import { ZipAssetEntry } from '../zip/ZipAssetEntry.js';
import { esbuildPackageEntries } from './esbuildPackageEntries.js';

export interface EsbuildPackageDirOptions {
  bundleName?: string;
  configPath?: string;
  entrypoint: string;
  ignorePaths?: string[];
  installPackages?: string[];
  outputPath?: string;
  packageArch?: string;
  packageFilePath?: string;
  packagePlatform?: string;
  packageLockPath?: string;
}

export async function esbuildPackageDir(
  dirPath: string,
  opts: EsbuildPackageDirOptions,
): Promise<void> {
  const outputPath =
    opts.outputPath || `dist/${opts.bundleName || 'bundle'}.zip`;
  const fullOutputPath = resolve(outputPath);
  const installPackages = opts.installPackages || [];

  const ignorePaths = opts.ignorePaths || [];
  ignorePaths.push(...(await readDotIgnoreForFolder(dirPath)));

  const configPath = resolve(dirPath, opts.configPath || 'esbuild.config.js');
  const configModule = await import(configPath);
  const config: BuildOptions = configModule.default || {};

  const buildOptions: BuildOptions = {
    ...config,
    entryPoints: [resolve(dirPath, opts.entrypoint)],
    absWorkingDir: resolve(dirPath),
  };

  const entries: ZipAssetEntry[] = [];

  for await (const entry of esbuildPackageEntries(buildOptions)) {
    entries.push(entry);
  }

  if (installPackages.length) {
    if (!opts.packageFilePath || !opts.packageLockPath) {
      throw new Error(
        `must specify package lock path and package.json path when installing packages`,
      );
    }
    const packageFiles = getPackageEntries({
      ignorePaths,
      packageArch: opts.packageArch,
      packageFilePath: opts.packageFilePath,
      packagePlatform: opts.packagePlatform,
      packageLockPath: opts.packageLockPath,
      packageNames: installPackages,
    });

    for await (const entry of packageFiles) {
      entries.push(entry);
    }
  }

  const output = await makeZipPackageStream(entries);

  await mkdir(dirname(fullOutputPath), { recursive: true });
  await pipeline(output, createWriteStream(fullOutputPath));

  await addBundleInfoToPackageJson(dirPath, {
    name: opts.bundleName,
    path: outputPath,
  });
}
