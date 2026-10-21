{{- define "lo-mio.labels" -}}
app.kubernetes.io/part-of: lo-mio
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}

{{- define "lo-mio.api.selector" -}}
app.kubernetes.io/name: api
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "lo-mio.api.image" -}}
{{ .Values.api.image.repository }}:{{ .Values.api.image.tag | default .Chart.AppVersion }}
{{- end }}

{{/* securityContext común a todos los contenedores: sin root, sin privilegios, FS de solo lectura. */}}
{{- define "lo-mio.containerSecurity" -}}
runAsNonRoot: true
runAsUser: 65532
runAsGroup: 65532
readOnlyRootFilesystem: true
allowPrivilegeEscalation: false
capabilities:
  drop: ["ALL"]
seccompProfile:
  type: RuntimeDefault
{{- end }}

{{- define "lo-mio.api.databaseEnv" -}}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ .Values.api.database.secretName }}
      key: {{ .Values.api.database.secretKey }}
{{- end }}

{{- define "lo-mio.guestWeb.selector" -}}
app.kubernetes.io/name: guest-web
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
