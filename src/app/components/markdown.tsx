import ReactMarkdown from "react-markdown";

export default function LessonMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-xl font-bold mb-6">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-semibold mb-6">{children}</h2>,
        ul: ({ children }) => <ul className="list-disc pl-6 mb-4">{children}</ul>,
        li: ({ children }) => <li className="mb-1">{children}</li>,
        p: ({ children }) => <p className="mb-4">{children}</p>,
        code: ({ node, className, children, ...props }) => {
          const isInline = 'inline' in props && props.inline;
          return isInline ? (
            <code
              className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          ) : (
            <pre className="bg-gray-100 text-gray-800 px-4 py-2 rounded border border-gray-200 overflow-x-auto mt-4 mb-4">
              <code className="font-mono text-sm" {...props}>
                {children}
              </code>
            </pre>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}