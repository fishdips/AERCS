package com.aercs.dto.response;

import java.util.UUID;

public record AccreditorSummaryResponse(
        UUID id,
        String name,
        String email
) {}
