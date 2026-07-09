export const mediaFolders = [
    {
        label: 'Ảnh đại diện',
        value: 'avatars',
        type: 'IMAGE',
        accept: 'image/*',
        description: 'Ảnh hồ sơ người dùng'
    },
    {
        label: 'Khóa học / Hình ảnh',
        value: 'courses/images',
        type: 'IMAGE',
        accept: 'image/*',
        description: 'Thumbnail, banner và hình minh họa khóa học'
    },
    {
        label: 'Khóa học / Video',
        value: 'courses/videos',
        type: 'VIDEO',
        accept: 'video/*',
        description: 'Video giới thiệu hoặc nội dung khóa học'
    },
    {
        label: 'Khóa học / Tài liệu',
        value: 'courses/documents',
        type: 'DOCUMENT',
        accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv',
        description: 'Giáo trình và tài liệu khóa học'
    },
    {
        label: 'Bài học / Hình ảnh',
        value: 'lessons/images',
        type: 'IMAGE',
        accept: 'image/*',
        description: 'Hình minh họa trong bài học'
    },
    {
        label: 'Bài học / Video',
        value: 'lessons/videos',
        type: 'VIDEO',
        accept: 'video/*',
        description: 'Video bài giảng'
    },
    {
        label: 'Bài học / Tài liệu',
        value: 'lessons/documents',
        type: 'DOCUMENT',
        accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv',
        description: 'File đính kèm bài học'
    },
    {
        label: 'Bài kiểm tra / Tài liệu',
        value: 'exams/documents',
        type: 'DOCUMENT',
        accept: '.pdf,.doc,.docx,.txt,.csv',
        description: 'Tài liệu liên quan đến bài kiểm tra'
    }
];

export const courseRelatedMediaFolders = mediaFolders.filter(
    (folder) =>
        folder.type !== 'VIDEO' &&
        ['courses/images', 'courses/documents', 'lessons/images', 'lessons/documents', 'exams/documents'].includes(
            folder.value
        )
);

export const mediaFolderMap = new Map(mediaFolders.map((folder) => [folder.value, folder]));

export function getMediaFolder(value) {
    return mediaFolderMap.get(value) ?? mediaFolders[0];
}
