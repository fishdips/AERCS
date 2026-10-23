package com.aercs.security;

import com.aercs.entity.User;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;

// Username is the user's UUID (not their email) - the rest of the app looks up
// the authenticated user by ID via @AuthenticationPrincipal.getUsername().
public class AercsUserPrincipal extends org.springframework.security.core.userdetails.User {

    private final int tokenVersion;

    public AercsUserPrincipal(User user) {
        super(user.getId().toString(), user.getPasswordHash(), user.isActive(),
                true, true, true,
                List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())));
        this.tokenVersion = user.getTokenVersion();
    }

    public int getTokenVersion() {
        return tokenVersion;
    }
}
