package com.aercs.entity;

public enum Office {
    QUALITY_ASSURANCE_OFFICE,
    RESEARCH_OFFICE,
    EXTENSION_OFFICE,
    REGISTRARS_OFFICE,
    LIBRARY,
    STUDENT_AFFAIRS_OFFICE,
    FACILITIES_MANAGEMENT_OFFICE,
    HUMAN_RESOURCE_OFFICE;

    public String getDisplayName() {
        return switch (this) {
            case QUALITY_ASSURANCE_OFFICE -> "Quality Assurance Office";
            case RESEARCH_OFFICE -> "Research Office";
            case EXTENSION_OFFICE -> "Extension Office";
            case REGISTRARS_OFFICE -> "Registrar’s Office";
            case LIBRARY -> "Library";
            case STUDENT_AFFAIRS_OFFICE -> "Student Affairs Office";
            case FACILITIES_MANAGEMENT_OFFICE -> "Facilities Management Office";
            case HUMAN_RESOURCE_OFFICE -> "Human Resource Office";
        };
    }
}
