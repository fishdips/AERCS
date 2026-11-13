package com.aercs.dto.response;

import java.util.List;

public record AccreditorNotificationListResponse(
        int unreadCount,
        List<AccreditorNotificationResponse> notifications
) {}
