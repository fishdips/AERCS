package com.aercs.entity;

/** What an accreditor is being told about one of their evidence links. */
public enum AccreditorNotificationType {
    /** An activity / evidence link was shared with them. */
    SHARED,
    /** The link expires within the next 24 hours. */
    EXPIRING_24H,
    /** The link expires within the next 4 hours. */
    EXPIRING_4H
}
