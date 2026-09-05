
-- Grant admin to greenbe929@gmail.com now
INSERT INTO public.user_roles (user_id, role)
VALUES ('6b205212-741f-440e-b3aa-627458604dc7', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Also remove any admin role from other users so this email is the sole admin
DELETE FROM public.user_roles
WHERE role = 'admin' AND user_id <> '6b205212-741f-440e-b3aa-627458604dc7';

-- Update the signup handler so this email always gets admin on (re)signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;

  IF lower(NEW.email) = 'greenbe929@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
