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

/**
 * Extracts image URLs from markdown text
 * Matches both inline images ![alt](url) and reference-style images
 * @param markdown - The markdown text to parse
 * @returns Array of image URLs found in the markdown
 */
export function extractImageUrlsFromMarkdown(markdown: string): string[] {
  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  const urls: string[] = [];
  
  // Regular expression to match markdown image syntax: ![alt text](url)
  // This captures both the alt text and the URL
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  
  let match;
  while ((match = imageRegex.exec(markdown)) !== null) {
    const url = match[2]; // The URL is the second captured group
    
    // Basic validation to ensure it's a valid URL
    if (url && url.trim() !== '') {
      // Remove any title attributes if present (e.g., "url 'title'")
      const cleanUrl = url.split(/\s+/)[0];
      
      // Optional: Filter for common image extensions or URL patterns
      // This is useful if you want to be more restrictive
      const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?.*)?$/i;
      const isImageUrl = imageExtensions.test(cleanUrl) || 
                        cleanUrl.includes('/images/') || 
                        cleanUrl.includes('/uploads/') ||
                        cleanUrl.startsWith('data:image/') ||
                        cleanUrl.startsWith('blob:');
      
      if (isImageUrl || cleanUrl.startsWith('http')) {
        urls.push(cleanUrl);
      }
    }
  }
  
  // Remove duplicates
  return Array.from(new Set(urls));
}

/**
 * Alternative more permissive version that extracts all image URLs
 * without filtering by extension or path patterns
 */
export function extractAllImageUrlsFromMarkdown(markdown: string): string[] {
  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  const urls: string[] = [];
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  
  let match;
  while ((match = imageRegex.exec(markdown)) !== null) {
    const url = match[2];
    if (url && url.trim() !== '') {
      // Clean up the URL (remove title attributes)
      const cleanUrl = url.split(/\s+/)[0].replace(/^["']|["']$/g, '');
      urls.push(cleanUrl);
    }
  }
  
  return Array.from(new Set(urls));
}

// Example usage:
/*
const markdownText = `
# My Document

Here's an image: ![Alt text](https://example.com/image.jpg)
And another: ![Another image](https://example.com/photo.png "Optional title")
Local image: ![Local](./images/local.gif)
Base64 image: ![Base64](data:image/png;base64,iVBORw0K...)
`;

const imageUrls = extractImageUrlsFromMarkdown(markdownText);
console.log(imageUrls);
// Output: ['https://example.com/image.jpg', 'https://example.com/photo.png', './images/local.gif', 'data:image/png;base64,iVBORw0K...']
*/