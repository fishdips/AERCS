package com.aercs.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * The application's source of "now" for time-sensitive logic (such as accreditor expiry warnings),
 * so tests can move time forward instead of waiting for it.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
