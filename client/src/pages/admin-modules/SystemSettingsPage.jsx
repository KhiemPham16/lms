import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiRefreshCcw, FiSave, FiSettings, FiWifi } from 'react-icons/fi';
import { toast } from 'sonner';

import { adminModulesApi } from '~/shared/api/adminModulesApi.js';
import { getApiMessage } from '~/shared/api/http.js';
import ui from '~/shared/styles/ui.module.scss';
import styles from './AdminModulePages.module.scss';

const labels = {
    'token-policy': 'Chính sách token',
    'upload-policy': 'Chính sách upload',
    mail: 'Email',
    redis: 'Redis',
    'grading-policy': 'Chính sách điểm',
    maintenance: 'Bảo trì'
};

const numberFields = new Set([
    'accessTokenMinutes',
    'refreshTokenDays',
    'maxActiveSessions',
    'imageMaxMb',
    'pdfMaxMb',
    'webpQuality',
    'port',
    'defaultPassScore',
    'finalEligibilityScore',
    'scoreScale'
]);

export function SystemSettingsPage() {
    const [settings, setSettings] = useState([]);
    const [drafts, setDrafts] = useState({});
    const [mailRecipient, setMailRecipient] = useState('');

    const settingByKey = useMemo(() => Object.fromEntries(settings.map((item) => [item.key, item])), [settings]);

    const loadSettings = useCallback(async () => {
        try {
            const rows = await adminModulesApi.listSettings();
            setSettings(rows);
            setDrafts(Object.fromEntries(rows.map((item) => [item.key, item.value ?? {}])));
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải được cấu hình hệ thống'));
        }
    }, []);

    useEffect(() => {
        const task = window.setTimeout(() => {
            loadSettings();
        }, 0);

        return () => window.clearTimeout(task);
    }, [loadSettings]);

    const updateDraft = (key, field, value, type) => {
        setDrafts((current) => ({
            ...current,
            [key]: {
                ...(current[key] ?? {}),
                [field]: type === 'checkbox' ? value : numberFields.has(field) ? Number(value) : value
            }
        }));
    };

    const saveSetting = async (key) => {
        try {
            await adminModulesApi.updateSetting(key, drafts[key] ?? {});
            toast.success(`Đã lưu ${labels[key] ?? key}`);
            loadSettings();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không lưu được cấu hình'));
        }
    };

    const testRedis = async () => {
        try {
            const result = await adminModulesApi.testRedis();
            toast.success(result.message ?? 'Kết nối Redis thành công');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không kiểm tra được Redis'));
        }
    };

    const testMail = async () => {
        try {
            const result = await adminModulesApi.testMail(mailRecipient);
            toast.success(result.message ?? 'Đã gửi email kiểm tra');
        } catch (error) {
            toast.error(getApiMessage(error, 'Không gửi được email kiểm tra'));
        }
    };

    const reloadSettings = async () => {
        try {
            const result = await adminModulesApi.reloadSettings();
            toast.success(result.message ?? 'Đã tải lại cấu hình');
            loadSettings();
        } catch (error) {
            toast.error(getApiMessage(error, 'Không tải lại được cấu hình'));
        }
    };

    const renderField = (key, field, value) => {
        if (typeof value === 'boolean') {
            return (
                <label className={styles.checkboxLine} key={field}>
                    <input type="checkbox" checked={Boolean(drafts[key]?.[field])} onChange={(event) => updateDraft(key, field, event.target.checked, 'checkbox')} />
                    {field}
                </label>
            );
        }
        return (
            <label className={ui.field} key={field}>
                {field}
                <input
                    className={ui.plainInput}
                    type={numberFields.has(field) ? 'number' : 'text'}
                    value={drafts[key]?.[field] ?? ''}
                    onChange={(event) => updateDraft(key, field, event.target.value)}
                />
            </label>
        );
    };

    return (
        <div className={ui.pageStack}>
            <section className={ui.moduleHeader}>
                <div className={ui.moduleHeaderIcon}><FiSettings /></div>
                <div>
                    <p className={ui.eyebrow}>Admin</p>
                    <h2>Cấu hình hệ thống</h2>
                    <p>Quản lý cấu hình runtime đang có trong BE.</p>
                </div>
            </section>

            <section className={ui.toolbar}>
                <button className={ui.secondaryButton} type="button" onClick={loadSettings}><FiRefreshCcw /> Tải lại</button>
                <button className={ui.secondaryButton} type="button" onClick={reloadSettings}><FiRefreshCcw /> Reload cache BE</button>
            </section>

            <section className={styles.cardGrid}>
                {settings.map((setting) => (
                    <article className={styles.recordCard} key={setting.key}>
                        <div className={styles.recordHeader}>
                            <div>
                                <p className={ui.eyebrow}>{setting.key}</p>
                                <h3>{labels[setting.key] ?? setting.key}</h3>
                            </div>
                            <button className={ui.primaryButton} type="button" onClick={() => saveSetting(setting.key)}><FiSave /> Lưu</button>
                        </div>
                        {(Object.entries(setting.value ?? {})).map(([field, value]) => renderField(setting.key, field, value))}
                        <span>Cập nhật: {setting.updatedAt ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(setting.updatedAt)) : 'Theo mặc định'}</span>
                    </article>
                ))}
            </section>

            <section className={styles.split}>
                <div className={ui.sectionBlock}>
                    <div className={ui.sectionHeading}>
                        <div>
                            <p className={ui.eyebrow}>Redis</p>
                            <h3>Kiểm tra kết nối</h3>
                        </div>
                    </div>
                    <p className={styles.hint}>Host hiện tại: {settingByKey.redis?.value?.host ?? '-'}</p>
                    <button className={ui.secondaryButton} type="button" onClick={testRedis}><FiWifi /> Test Redis</button>
                </div>
                <div className={ui.sectionBlock}>
                    <div className={ui.sectionHeading}>
                        <div>
                            <p className={ui.eyebrow}>Email</p>
                            <h3>Gửi email kiểm tra</h3>
                        </div>
                    </div>
                    <label className={ui.field}>Email nhận<input className={ui.plainInput} type="email" value={mailRecipient} onChange={(event) => setMailRecipient(event.target.value)} /></label>
                    <button className={ui.secondaryButton} type="button" onClick={testMail} disabled={!mailRecipient}>Gửi test mail</button>
                </div>
            </section>
        </div>
    );
}
