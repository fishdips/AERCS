package com.aercs.service;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Keeps object storage in step with the database transaction around it.
 *
 * <p>Storage is a separate system, so it can't take part in the database transaction. Instead:
 * <ul>
 *   <li>a file uploaded during a transaction is removed again if that transaction does not commit,
 *       so a failed save never leaves an orphaned file behind;</li>
 *   <li>a file is deleted only after the transaction commits, so a rollback never loses a file
 *       that the database still points at.</li>
 * </ul>
 * Outside a transaction both operations simply happen immediately.
 */
@Component
@RequiredArgsConstructor
public class TransactionalStorage {

    private static final Logger log = LoggerFactory.getLogger(TransactionalStorage.class);

    private final SupabaseStorageService storage;

    public void upload(String objectPath, byte[] bytes, String contentType) {
        storage.upload(objectPath, bytes, contentType);
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCompletion(int status) {
                    if (status != STATUS_COMMITTED) {
                        deleteQuietly(objectPath);
                    }
                }
            });
        }
    }

    public void deleteAfterCommit(String objectPath) {
        if (objectPath == null || objectPath.isBlank()) return;
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteQuietly(objectPath);
                }
            });
        } else {
            deleteQuietly(objectPath);
        }
    }

    private void deleteQuietly(String objectPath) {
        try {
            storage.delete(objectPath);
        } catch (RuntimeException e) {
            // Worst case is an unreferenced file in the bucket; it must not fail the request.
            log.warn("Could not delete storage object {}", objectPath, e);
        }
    }
}
