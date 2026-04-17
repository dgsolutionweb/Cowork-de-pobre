import path from "node:path";

export const normalizePath = (value: string) => path.resolve(value);

export const isWithinAllowedPaths = (
  targetPath: string,
  allowedPaths: string[],
) => {
  const normalizedTarget = normalizePath(targetPath);
  return allowedPaths.some((allowedPath) => {
    const normalizedAllowed = normalizePath(allowedPath);
    return (
      normalizedTarget === normalizedAllowed ||
      normalizedTarget.startsWith(`${normalizedAllowed}${path.sep}`)
    );
  });
};

export const labelFromPath = (directoryPath: string) => {
  const normalized = normalizePath(directoryPath);
  return path.basename(normalized) || normalized;
};

export const ensureAllowedPath = (
  targetPath: string,
  allowedPaths: string[],
  operationLabel: string,
) => {
  if (!isWithinAllowedPaths(targetPath, allowedPaths)) {
    throw new Error(
      `${operationLabel} bloqueado: o caminho ${targetPath} está fora das pastas autorizadas.`,
    );
  }
};
