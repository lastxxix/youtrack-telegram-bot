export interface YouTrackProject {
    id: string,
    name: string
}

export interface YouTrackIssue {
    project: {
        id: string
    }
    summary: string;
    description?: string;
}

export interface TempYouTrackIssue {
    projectId?: string;
    summary?: string;
    description?: string;
}

export interface YouTrackNotification {
    id: string;
    $type: string;
    metadata: string;
    content: string;
}