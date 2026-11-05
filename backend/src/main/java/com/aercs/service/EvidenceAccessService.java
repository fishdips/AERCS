package com.aercs.service;

import com.aercs.entity.Activity;
import com.aercs.entity.Department;
import com.aercs.entity.Evidence;
import com.aercs.entity.Office;
import com.aercs.entity.RelatedOffice;
import com.aercs.entity.User;
import com.aercs.entity.UserRole;
import com.aercs.exception.ForbiddenException;
import com.aercs.exception.ResourceNotFoundException;
import com.aercs.repository.EvidenceReferenceRepository;
import com.aercs.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Single place that decides who may see, or add to, an activity's evidence.
 * <ul>
 *   <li>ADMIN and INSTITUTIONAL_OFFICE can see everything.</li>
 *   <li>Department staff / chairpersons can see their own unit's evidence, service-office
 *       evidence, evidence tagged for their unit, and evidence already referenced into one
 *       of their own activities - nothing from other departments.</li>
 * </ul>
 * Failed reads are reported as 404 so the existence of another unit's file is not revealed.
 */
@Service
@RequiredArgsConstructor
public class EvidenceAccessService {

    private static final Map<Department, RelatedOffice> DEPARTMENT_TO_RELATED = Map.of(
            Department.CCS, RelatedOffice.COLLEGE_OF_COMPUTER_STUDIES,
            Department.CEA, RelatedOffice.COLLEGE_OF_ENGINEERING_AND_ARCHITECTURE,
            Department.CNAHS, RelatedOffice.COLLEGE_OF_NURSING,
            Department.CMBA, RelatedOffice.COLLEGE_OF_MANAGEMENT_BUSINESS_AND_ACCOUNTANCY,
            Department.CASE, RelatedOffice.COLLEGE_OF_ARTS_AND_SCIENCES,
            Department.CCJ, RelatedOffice.COLLEGE_OF_CRIMINAL_JUSTICE
    );

    private final UserRepository userRepository;
    private final EvidenceReferenceRepository referenceRepository;

    public User requireUser(String identifier) {
        if (identifier == null) throw new ForbiddenException("User not found");
        return userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new ForbiddenException("User not found"));
    }

    public void assertCanViewActivity(Activity activity, String identifier) {
        if (!canViewActivity(activity, requireUser(identifier))) {
            throw new ResourceNotFoundException("Activity not found");
        }
    }

    public void assertCanViewEvidence(Evidence evidence, String identifier) {
        if (!canViewEvidence(evidence, requireUser(identifier))) {
            throw new ResourceNotFoundException("Evidence file not found");
        }
    }

    public void assertCanAddToActivity(Activity activity, String identifier) {
        User user = requireUser(identifier);
        if (user.getRole() == UserRole.ADMIN) return;
        if (!inOwnUnit(activity, user)) {
            throw new ForbiddenException("You can only upload evidence to your own department or office's activities. Upload it under your own activity and tag the other department or office instead.");
        }
    }

    public boolean canViewEvidence(Evidence evidence, User user) {
        if (evidence == null || user == null) return false;
        if (seesEverything(user)) return true;
        if (!isUnitScoped(user)) return false;

        if (canViewActivity(evidence.getActivity(), user)) return true;

        RelatedOffice related = relatedOffice(user);
        String tagged = evidence.getRelatedOffices();
        if (related != null && tagged != null && tagged.contains(related.name())) return true;

        return referenceRepository.findReferencingActivities(evidence.getId()).stream()
                .anyMatch(a -> inOwnUnit(a, user));
    }

    public boolean canViewActivity(Activity activity, User user) {
        if (activity == null || user == null) return false;
        if (seesEverything(user)) return true;
        if (!isUnitScoped(user)) return false;
        return inOwnUnit(activity, user) || isServiceOfficeActivity(activity);
    }

    private boolean seesEverything(User user) {
        return user.getRole() == UserRole.ADMIN || user.getRole() == UserRole.INSTITUTIONAL_OFFICE;
    }

    private boolean isUnitScoped(User user) {
        return user.getRole() == UserRole.DEPT_STAFF || user.getRole() == UserRole.ACCRED_COORDINATOR;
    }

    private boolean inOwnUnit(Activity activity, User user) {
        if (activity == null) return false;
        Department dept = user.resolveDepartment();
        if (dept != null && dept == activity.getDepartment()) return true;
        String office = user.getOffice();
        return office != null && office.equalsIgnoreCase(activity.getOffice());
    }

    private boolean isServiceOfficeActivity(Activity activity) {
        String office = activity.getOffice();
        if (office == null) return false;
        try {
            return Office.valueOf(office).isServiceOffice();
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private RelatedOffice relatedOffice(User user) {
        Department dept = user.resolveDepartment();
        if (dept != null) return DEPARTMENT_TO_RELATED.get(dept);
        Office office = user.resolveOffice();
        if (office == null) return null;
        try {
            return RelatedOffice.valueOf(office.name());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
