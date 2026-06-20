export default function PermissionCheckbox({ checked, onChange, label }) {
    return (
        <label className="permission-check">
            <span>{label}</span>
            <input type="checkbox" checked={checked} onChange={onChange} />
        </label>
    );
}
