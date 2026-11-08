import { AIcon } from './ui/Icon';

/** Shown when the database lacks something this screen needs (supabase/schema.sql not run since the update). */
export function UpgradeNotice({ message }: { message: string }) {
  return (
    <div className="card">
      <div className="alert danger">
        <AIcon name="warning" duo />
        <div className="grow">
          <b>این بخش هنوز آماده نیست</b>
          <p>{message}</p>
          <p>Supabase → SQL Editor → محتوای فایل supabase/schema.sql را اجرا کنید؛ داده‌های فعلی دست نمی‌خورند و مشتریان از سفارش‌های قبلی ساخته می‌شوند.</p>
        </div>
      </div>
    </div>
  );
}
