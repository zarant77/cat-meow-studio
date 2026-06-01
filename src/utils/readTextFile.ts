export function readTextFile(file: File): Promise<string> {
  return file.text();
}
