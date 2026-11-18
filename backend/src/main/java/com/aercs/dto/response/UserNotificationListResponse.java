package com.aercs.dto.response;

import java.util.List;

public record UserNotificationListResponse(
        int unreadCount,
        List<UserNotificationResponse> notifications
) {}
