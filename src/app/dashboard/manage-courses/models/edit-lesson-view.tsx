import { Plus, Save } from "lucide-react";

type EditLessonViewProps = {
  lesson: Partial<Lesson>;
  // @ts-ignore
  onUpdate: (key: keyof Lesson, value: any) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddVideo: () => void;
  onRemoveVideo: (index: number) => void;
  onAddResource: () => void;
  onRemoveResource: (index: number) => void;
}

export default function EditLessonView({ lesson, onUpdate, onSave, onCancel, onAddVideo, onRemoveVideo, onAddResource, onRemoveResource }: EditLessonViewProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Edit Lesson</h2>
        <button
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          Cancel
        </button>
      </div>

      <input
        type="text"
        value={lesson.title || ''}
        onChange={(e) => onUpdate("title", e.target.value)}
        placeholder="Lesson title..."
        className="text-xl font-semibold border-b border-gray-300 w-full focus:outline-none focus:border-blue-500 pb-2"
      />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
        <textarea
          value={lesson.description || ''}
          onChange={(e) => onUpdate("description", e.target.value)}
          rows={6}
          placeholder="Write your lesson description in Markdown..."
          className="w-full border border-gray-300 p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Video URLs</h3>
          <button
            onClick={onAddVideo}
            className="text-blue-600 text-sm hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Video
          </button>
        </div>
        {lesson.videoUrl && lesson.videoUrl.length > 0 ? (
          lesson.videoUrl.map((video, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="url"
                value={video || ''}
                onChange={(e) => {
                  const updated = [...(lesson.videoUrl || [])];
                  updated[idx] = e.target.value;
                  onUpdate("videoUrl", updated);
                }}
                placeholder="https://example.com/video.mp4"
                className="flex-1 text-sm border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={() => onRemoveVideo(idx)}
                className="text-red-500 hover:text-red-700 p-2"
              >
                &times;
              </button>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm italic">No videos added yet</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Resource Links</h3>
          <button
            onClick={onAddResource}
            className="text-blue-600 text-sm hover:text-blue-700 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Resource
          </button>
        </div>
        {lesson.resourceLinks && lesson.resourceLinks.length > 0 ? (
          lesson.resourceLinks.map((resource, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                value={resource?.title || ''}
                onChange={(e) => {
                  const updated = [...(lesson.resourceLinks || [])];
                  updated[idx] = { ...updated[idx], title: e.target.value };
                  onUpdate("resourceLinks", updated);
                }}
                placeholder="Resource title"
                className="w-1/3 text-sm border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
              />
              <input
                type="url"
                value={resource?.url || ''}
                onChange={(e) => {
                  const updated = [...(lesson.resourceLinks || [])];
                  updated[idx] = { ...updated[idx], url: e.target.value };
                  onUpdate("resourceLinks", updated);
                }}
                placeholder="https://example.com"
                className="w-2/3 text-sm border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => onRemoveResource(idx)}
                className="text-red-500 hover:text-red-700 p-2"
              >
                &times;
              </button>
            </div>
          ))
        ) : (
          <p className="text-gray-500 text-sm italic">No resources added yet</p>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          onClick={onSave}
          className="flex items-center gap-2 bg-green-600 text-white text-sm px-6 py-2 hover:bg-green-700 transition"
        >
          <Save className="w-4 h-4" />
          Save Changes
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-sm hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </>
  );
}