import google.auth
import json
import io
import qrcode
import requests
import os
from firebase_admin import credentials, firestore, auth, storage, initialize_app
from firebase_functions import https_fn
from google.cloud import storage as gcs_storage
from PIL import Image, ImageDraw, ImageFont

# --- Bloco de Inicialização ---
# Usando o arquivo de chave diretamente
cred_path = 'service-account.json'
cred = credentials.Certificate(cred_path)
initialize_app(credential=cred)

db = firestore.client()
gcs_client = gcs_storage.Client.from_service_account_json(cred_path)
# --- Fim do Bloco de Inicialização ---




@https_fn.on_request(timeout_sec=300, memory=512)
def deleteUser(req: https_fn.Request) -> https_fn.Response:
    """
    Função de backend para excluir um usuário do sistema.
    Recebe um JSON com o 'uid' do usuário.
    """
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if req.method == 'OPTIONS':
        return https_fn.Response('', headers=headers)

    if req.method == 'POST':
        try:
            request_json = req.get_json(silent=True)
            if not request_json or 'uid' not in request_json:
                raise ValueError('Requisição inválida. O corpo JSON deve conter um "uid".')
            
            user_uid = request_json['uid']

            db.collection('usuarios').document(user_uid).delete()
            auth.delete_user(user_uid)
            
            response_data = {'status': 'success', 'message': f'Usuário {user_uid} excluído com sucesso.'}
            return https_fn.Response(json.dumps(response_data), status=200, headers=headers, mimetype="application/json")
            
        except ValueError as e:
            response_data = {'status': 'error', 'message': str(e)}
            return https_fn.Response(json.dumps(response_data), status=400, headers=headers, mimetype="application/json")
        except auth.AuthError as e:
            response_data = {'status': 'error', 'message': f'Erro do Firebase Auth: {str(e)}'}
            return https_fn.Response(json.dumps(response_data), status=400, headers=headers, mimetype="application/json")
        except Exception as e:
            response_data = {'status': 'error', 'message': f'Erro ao excluir usuário: {str(e)}'}
            return https_fn.Response(json.dumps(response_data), status=500, headers=headers, mimetype="application/json")
    else:
        response_data = {'status': 'error', 'message': 'Método não permitido. Use POST ou OPTIONS.'}
        return https_fn.Response(json.dumps(response_data), status=405, headers=headers, mimetype="application/json")


@https_fn.on_request(timeout_sec=300, memory=512)
def generateAndStoreQrCode(req: https_fn.Request) -> https_fn.Response:
    """
    Gera um QR Code para um convidado, salva a imagem no Firebase Storage
    e a URL no Firestore.
    """
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    if req.method == 'OPTIONS':
        return https_fn.Response('', headers=headers)

    try:
        data = req.get_json(silent=True)
        print("Dados recebidos:", data) # DEBUG
        if not data or 'eventId' not in data or 'nome' not in data:
            raise ValueError('Dados inválidos. Espera-se "eventId" e "nome".')
        
        event_id = data['eventId']
        guest_name = data['nome']
        
        # 1. Gerar o QR Code
        qr_data = '{"eventId": "' + event_id + '", "nome": "' + guest_name + '"}'
        qr_gen = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr_gen.add_data(qr_data)
        qr_gen.make(fit=True)
        qr_image = qr_gen.make_image(fill_color="black", back_color="white")
        
        img_buffer = io.BytesIO()
        qr_image.save(img_buffer, format="PNG")
        img_buffer.seek(0)
        
        bucket_name = 'kd-qr-codes-checkin-eventos.appspot.com'
        bucket = gcs_client.bucket(bucket_name)
        blob_path = f'qrcodes/{event_id}/{guest_name}.png'
        blob = bucket.blob(blob_path)
        
        blob.upload_from_file(img_buffer, content_type='image/png')
        
        public_url = f"https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{blob_path.replace('/', '%2F')}?alt=media"
        
        # 2. SALVAR OS DADOS DO CONVIDADO E O URL DO QR CODE NO FIRESTORE
        guest_data = {
            'nome': guest_name,
            'qrCode': public_url,
            'checkin': False,
            'createdAt': firestore.SERVER_TIMESTAMP
        }
        
        db.collection('eventos').document(event_id).collection('convidados').add(guest_data)
        
        return https_fn.Response(json.dumps({'public_url': public_url}), mimetype="application/json", status=200, headers=headers)
        
    except ValueError as e:
        return https_fn.Response(json.dumps({'error': str(e)}), mimetype="application/json", status=400, headers=headers)
    except Exception as e:
        print("Erro na função generateAndStoreQrCode:", e) # DEBUG
        response_data = {'error': 'Erro interno do servidor: ' + str(e)}
        return https_fn.Response(json.dumps(response_data), mimetype="application/json", status=500, headers=headers)


@https_fn.on_request(timeout_sec=300, memory=512)
def generateArt(req: https_fn.Request) -> https_fn.Response:
    """
    Gera a arte do convite mesclando o QR Code com um template de imagem.
    A Cloud Function retorna a imagem combinada.
    """
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    if req.method == 'OPTIONS':
        return https_fn.Response('', headers=headers)

    try:
        data = req.get_json(silent=True)
        if not data or 'eventId' not in data or 'nome' not in data:
            raise ValueError('Dados inválidos. Espera-se "eventId" e "nome".')

        event_id = data['eventId']
        guest_name = data['nome']

        event_doc_ref = db.collection('eventos').document(event_id)
        event_doc = event_doc_ref.get()

        if not event_doc.exists or 'artTemplateUrl' not in event_doc.to_dict():
            raise ValueError('Template de arte não encontrado para este evento.')
            
        template_url = event_doc.to_dict()['artTemplateUrl']

        template_response = requests.get(template_url)
        template_image = Image.open(io.BytesIO(template_response.content))

        qr_data = '{"eventId": "' + event_id + '", "nome": "' + guest_name + '"}'
        qr_gen = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr_gen.add_data(qr_data)
        qr_gen.make(fit=True)
        qr_image = qr_gen.make_image(fill_color="black", back_color="white")
        
        qr_image_resized = qr_image.resize((415, 415))

        position_x = 337
        position_y = 1257
        qr_width = 415
        qr_height = 415
        
        position_x_final = position_x + (415 - qr_width) // 2
        position_y_final = position_y + (415 - qr_height) // 2

        template_image.paste(qr_image_resized, (position_x_final, position_y_final))

        img_buffer = io.BytesIO()
        template_image.save(img_buffer, format="PNG")
        img_buffer.seek(0)
        
        return https_fn.Response(img_buffer.getvalue(), mimetype="image/png", status=200, headers=headers)

    except ValueError as e:
        return https_fn.Response(json.dumps({'error': str(e)}), mimetype="application/json", status=400, headers=headers)
    except Exception as e:
        response_data = {'error': 'Erro interno do servidor: ' + str(e)}
        return https_fn.Response(json.dumps(response_data), mimetype="application/json", status=500, headers=headers)
