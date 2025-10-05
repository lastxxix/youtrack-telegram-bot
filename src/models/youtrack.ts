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

export interface YouTrackNotificationResponse {
    id: string;
    $type: string;
    metadata: string;
    content: string;
}

export interface YouTrackNotification {
    issueId: string;
    project: {
        entityId: string;
        name: string;
        shortName: string;
    };
    summary: string;
    description?: string;
    eventType: string;
    timestamp: number;
    category: string;
    comment?: string;
    state?: string;
    priority?: string;
    assignee?: string;
    oldState?: string;
    newState?: string;
}