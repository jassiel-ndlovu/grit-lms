export async function uploadFile(file: File, folder?: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  if (folder) {
    formData.append("folder", folder);
  }

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error("Failed to upload file");
  }

  const data = await res.json();
  return data.url as string;
}

export async function deleteFile(fileUrl: string): Promise<boolean> {
  const res = await fetch("/api/upload", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: fileUrl }),
  });

  if (!res.ok) {
    throw new Error("Failed to delete file");
  }

  return true;
}

export async function updateFile(
  oldUrl: string,
  newFile: File,
  folder?: string
): Promise<string> {
  // 1. Delete old file
  await deleteFile(oldUrl);

  // 2. Upload new one (to same folder if provided)
  const newUrl = await uploadFile(newFile, folder);

  return newUrl;
}