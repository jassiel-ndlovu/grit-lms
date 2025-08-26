export function getYouTubeId(url: string) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatTime = (seconds: number) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (days > 0) {
    // Example: "4d 12h"
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    // Example: "12h 5m 33s"
    return `${hours}h ${minutes}m ${secs}s`;
  }

  // Example: "05:07"
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};


export const formatForDateTimeLocal = (date: Date): string => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16); // "YYYY-MM-DDTHH:mm"
};

export const parseDateTimeLocal = (dateString: string): Date => {
  const localDate = new Date(dateString);
  return new Date(localDate.getTime());
};

export const extractImageUrlsFromMarkdown = (markdown: string): string[] => {
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  const urls: string[] = [];
  let match;
  
  while ((match = imageRegex.exec(markdown)) !== null) {
    urls.push(match[1]);
  }
  
  return urls;
};

export function cleanUrl(slug: string): string {
  let decoded = decodeURIComponent(slug);

  const lastHyphenIndex = decoded.lastIndexOf("-");
  if (lastHyphenIndex !== -1) {
    decoded = decoded.substring(0, lastHyphenIndex);
  }

  return decoded.replace(/-/g, " ").trim();
}
