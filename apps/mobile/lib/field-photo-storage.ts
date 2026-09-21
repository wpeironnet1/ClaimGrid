import * as FileSystem from "expo-file-system/legacy";

const PHOTO_DIRECTORY_NAME = "claimgrid-field-photos";

function photoDirectory(): string {
  if (!FileSystem.documentDirectory) throw new Error("Durable app storage is unavailable on this device.");
  return `${FileSystem.documentDirectory}${PHOTO_DIRECTORY_NAME}/`;
}

function safeExtension(uri: string): string {
  const match = uri.split("?")[0].match(/\.([a-zA-Z0-9]{1,5})$/);
  return match && ["jpg", "jpeg", "png", "heic", "webp"].includes(match[1].toLowerCase())
    ? match[1].toLowerCase()
    : "jpg";
}

export async function persistFieldPhoto(sourceUri: string, observationId: string): Promise<string> {
  const directory = photoDirectory();
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const destination = `${directory}${encodeURIComponent(observationId)}.${safeExtension(sourceUri)}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destination });
  return destination;
}

export function isManagedFieldPhoto(uri: string | null | undefined): uri is string {
  if (!uri || !FileSystem.documentDirectory) return false;
  return uri.startsWith(`${FileSystem.documentDirectory}${PHOTO_DIRECTORY_NAME}/`);
}

export async function removeManagedFieldPhoto(uri: string | null | undefined): Promise<void> {
  if (!isManagedFieldPhoto(uri)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
}
