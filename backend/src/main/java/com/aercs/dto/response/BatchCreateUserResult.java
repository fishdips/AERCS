package com.aercs.dto.response;

public record BatchCreateUserResult(
        String email,
        boolean success,
        CreateUserResponse user,
        String error
) {}
